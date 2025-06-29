// app.component.ts
import {Component, computed, ElementRef, inject, OnDestroy, signal, ViewChild, WritableSignal,} from '@angular/core';
import {Location, NgIf} from '@angular/common';
import {LoadingComponent} from '../../components/loading/loading.component';
import {Subscription} from 'rxjs';
import {HttpClient} from '@angular/common/http';
import {CaptureButton} from '../../components/capture-button/capture-button.component';
import {Router} from '@angular/router';
import {ParametersService} from '../../services/parameters.service';
import {SubvisionCoreService} from '../../../lib/subvision-core.service';
import {OpencvImshowComponent} from '../../components/opencv-imshow/opencv-imshow.component';
import {OpencvImshowService} from '../../services/opencv-imshow.service';


type Coordinates = {
  x: number; y: number;
};

@Component({
  selector: 'app-camera-preview',
  templateUrl: './camera-preview.component.html',
  styleUrls: ['./camera-preview.component.scss'],
  standalone: true,
  imports: [NgIf, LoadingComponent, CaptureButton, OpencvImshowComponent],
})
export class CameraPreviewComponent implements OnDestroy {
  private static readonly MAX_FPS = 2;
  protected readonly CORRECT_COORDINATES_BEFORE_PROCESS = ParametersService.get('VALID_SHEET_BEFORE_PROCESS').value;
  private static readonly PREPROCESSING_SIZE = 500;
  @ViewChild('videoRef') videoRef!: ElementRef<HTMLVideoElement>;
  @ViewChild('inputCanvasRef') inputCanvasRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('svg') svg: ElementRef | undefined;
  private input_canvas_ctx: CanvasRenderingContext2D | null;
  private opencvImshowService: OpencvImshowService = inject(OpencvImshowService);
  private readonly location: Location = inject(Location);

  private readonly router: Router = inject(Router);

  private processImageWorker: Worker | null = null;
  protected videoWidth = signal<number>(0);
  protected videoHeight = signal<number>(0);
  protected aspectRatio = computed((): number => {
    return this.videoWidth() / this.videoHeight();
  });

  protected viewBox = computed<string>(() => {
      return `0 0 ${this.videoWidth()} ${this.videoHeight()}`;
    }
  );

  goBack() {
    this.location.back();
  }

  readonly loading: WritableSignal<{ text: string; progress: number | null } | null> = signal<{
    text: string;
    progress: number | null
  } | null>({
    text: 'Loading Subvision Core', progress: null,
  });
  image: string | null = null;
  coordinates = signal<Coordinates[]>([]);
  coordinatesPercent = computed<Coordinates[]>(() => {
    return this.coordinates().map((coordinate: any): Coordinates => {
      return {
        x: coordinate.x * 100, y: coordinate.y * 100,
      };
    })
  });
  numberOfValidCoordinates = signal<number>(0);


  // Configs
  modelInputShape = [1, 3, 640, 640];
  protected path = computed<string>(() => {
    if (!this.coordinates()) {
      return '';
    }

    let result = '';
    for (const coordinate of this.coordinates()) {
      result += `${this.videoWidth() * coordinate.x},${this.videoHeight() * coordinate.y} `;
    }

    if (result.length < 2) {
      return '';
    }

    return `M ${result.slice(0, -1)} Z`;
  });
  private readonly http: HttpClient = inject(HttpClient);
  private continuous: boolean = false;
  private openCVState: Subscription;
  private camera_stream: null | MediaStream = null;
  private readonly subvisionCoreService: SubvisionCoreService = inject(SubvisionCoreService);

  constructor() {
    this.startCamera();

    this.openCVState = this.subvisionCoreService.cvState.subscribe((state) => {
      if (state.ready) {
        this.loading.set(null);
      } else if (state.error) {
        this.loading.set({text: 'Failed to load Subvision Core', progress: null});
      } else if (state.loading) {
        this.loading.set({text: 'Loading Subvision Core', progress: null});
      }
    });
  }


  async getImageBase64(fullSize: boolean = false): Promise<string> {
    this.inputCanvasRef.nativeElement.width = fullSize ? this.videoRef.nativeElement.videoWidth : CameraPreviewComponent.PREPROCESSING_SIZE;
    this.inputCanvasRef.nativeElement.height = fullSize ? this.videoRef.nativeElement.videoHeight : CameraPreviewComponent.PREPROCESSING_SIZE;
    this.input_canvas_ctx?.drawImage(this.videoRef.nativeElement, 0, 0, this.inputCanvasRef.nativeElement.width, this.inputCanvasRef.nativeElement.height);
    return this.inputCanvasRef.nativeElement.toDataURL('image/webp', 0.5).replace('data:image/webp;base64,', '');
  }

  getImageData(fullSize: boolean = false): ImageData {

    const canvasElement = this.inputCanvasRef.nativeElement;

    this.inputCanvasRef.nativeElement.width = this.videoRef.nativeElement.videoWidth || CameraPreviewComponent.PREPROCESSING_SIZE;
    this.inputCanvasRef.nativeElement.height = this.videoRef.nativeElement.videoHeight || CameraPreviewComponent.PREPROCESSING_SIZE;
    this.input_canvas_ctx?.drawImage(this.videoRef.nativeElement, 0, 0, canvasElement.width, canvasElement.height);
    if (canvasElement.width === 0 || canvasElement.height === 0) {
      console.warn('Canvas dimensions are zero, returning empty ImageData');
      return new ImageData(0, 0);
    }
    return this.input_canvas_ctx?.getImageData(0, 0, canvasElement.width, canvasElement.height) || new ImageData(0, 0);
  }


  async startCamera(): Promise<void> {
    console.log('Starting Camera...');
    this.loading.set({text: 'Starting Camera...', progress: null});
    // capture frame loop
    const capture_frame_continuous = async () => {
      const start = performance.now();
      this.videoWidth.set(this.videoRef.nativeElement.videoWidth);
      this.videoHeight.set(this.videoRef.nativeElement.videoHeight);
      if (!this.continuous || this.loading()) return;
      const imageData = this.getImageData(true)
      const lastCoordinates = this.coordinates();
      let coordinates: any = null;
      try {
        coordinates = this.subvisionCoreService.instance.getSheetCoordinates(imageData.width, imageData.height, imageData.data);
      } catch (error) {
        console.log('Error processing image data:', error);
      }
      this.coordinates.set(coordinates);

      if (coordinates) {

        this.numberOfValidCoordinates.update((value) => {
          if (this.coordinates()?.length && lastCoordinates?.length) {
            const currentCoordinates = this.coordinates();
            const lastCentroid = lastCoordinates.reduce((acc, coordinate) => {
                return {x: acc.x + coordinate.x, y: acc.y + coordinate.y};
              }
              , {x: 0, y: 0});
            lastCentroid.x /= currentCoordinates.length;
            lastCentroid.y /= currentCoordinates.length;
            const currentCentroid = currentCoordinates.reduce((acc, coordinate) => {
                return {x: acc.x + coordinate.x, y: acc.y + coordinate.y};
              }
              , {x: 0, y: 0});
            currentCentroid.x /= coordinates.length;
            currentCentroid.y /= coordinates.length;
            const distance = Math.sqrt(Math.pow(currentCentroid.x - lastCentroid.x, 2) + Math.pow(currentCentroid.y - lastCentroid.y, 2));
            if (Math.abs(distance) > 0.1) {
              return 0;
            }
          }


          return this.coordinates()?.length ? Math.min(value + 1, this.CORRECT_COORDINATES_BEFORE_PROCESS) : 0;
        });
      }

      const end = performance.now();
      setTimeout(() => {
        requestAnimationFrame(capture_frame_continuous)
      }, 1000 / CameraPreviewComponent.MAX_FPS - (end - start));
    };

    // get user media
    this.camera_stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: 'environment', width: {max: 3880, ideal: 1920}, height: {max: 2160, ideal: 1080},
      }, audio: false,
    });
    this.videoRef.nativeElement.srcObject = this.camera_stream; // set to <video>
    this.input_canvas_ctx = this.inputCanvasRef.nativeElement.getContext('2d', {
      willReadFrequently: true,
    }); // get input <canvas> ctx
    // start frame capture
    this.continuous = true;
    this.loading.set(null);
    this.setLoading(null);
    await capture_frame_continuous();
  }

  imageDataToBase64(imageData: ImageData) {
    const canvas = document.createElement("canvas");
    canvas.width = imageData.width;
    canvas.height = imageData.height;

    const ctx = canvas.getContext("2d");
    ctx.putImageData(imageData, 0, 0);

    const s = canvas.toDataURL("image/png");
    canvas.remove();
    return s; //
  }

  async capture(): Promise<void> {
    if (this.CORRECT_COORDINATES_BEFORE_PROCESS <= this.numberOfValidCoordinates()) {

      this.setLoading({text: 'Processing Image...', progress: null});
      const imageData = this.getImageData(true);

      const worker = new Worker(new URL('../../workers/subvision.worker', import.meta.url), {type: 'classic'});
      worker.postMessage({
        width: imageData.width,
        height: imageData.height,
        data: imageData.data,
        type: 'processTargetImage',
      });

      worker.onmessage = ({data}) => {
        this.router.navigate(['/camera/result'], {
          state: {
            data: {
              impacts: data.impacts,
              image: this.imageDataToBase64(new ImageData(new Uint8ClampedArray(data.annotatedImage.data), data.annotatedImage.columns, data.annotatedImage.rows))
            }, edit: true
          }
        });
        worker.terminate();
      };

    }

  }

  setLoading(loading: { text: string; progress: number | null } | null): void {
    this.loading.set(loading);
  }

  ngOnDestroy(): void {
    this.openCVState?.unsubscribe();
    this.camera_stream?.getTracks()?.forEach((track) => track.stop());
    this.videoRef.nativeElement.srcObject = null;
    this.camera_stream = null;
    this.continuous = false;
  }
}
