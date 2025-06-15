import {Component, ElementRef, HostListener, Inject, ViewChild,} from '@angular/core';
import {CommonModule, DOCUMENT} from '@angular/common';
import {OpencvImshowComponent} from '../../../components/opencv-imshow/opencv-imshow.component';
import {OpenCVState} from '../../../../lib/models';
import {SubvisionCoreService} from '../../../../lib/subvision-core.service';
import {Router} from '@angular/router';
import {PlastronService} from '../../../services/plastron.service';
import {FilesService} from '../../../services/files.service';

@Component({
  selector: 'app-cv',
  standalone: true,
  imports: [CommonModule, OpencvImshowComponent],
  templateUrl: './cv.component.html',
  styleUrl: './cv.component.scss',
})
export class CvComponent {
  searchingPlastron: boolean = false;

  get coordinatesPercent(): any {
    return this._coordinatesPercent;
  }

  set coordinatesPercent(value: any) {
    this._coordinatesPercent = value;
    this.path?.nativeElement.setAttribute('d', this.getPath());
  }

  stream: MediaStream | undefined;
  _video: ElementRef | undefined;

  get video(): ElementRef | undefined {
    return this._video;
  }

  // @ViewChild('video', { static: true }) set video(el: ElementRef | undefined) {
  //   console.log('video', el);
  //   if (el) {
  //     this._video = el;
  //     const scope = this;
  //     navigator.mediaDevices
  //       .getUserMedia({
  //         video: {
  //           width: { ideal: 4096 },
  //           height: { ideal: 2160 },
  //           facingMode: 'environment',
  //         },
  //
  //         audio: false,
  //       })
  //       .then(function (stream: MediaStream) {
  //         let video = el.nativeElement;
  //         console.log('video', stream);
  //         if (video) {
  //           // @ts-ignore
  //           video.srcObject = stream;
  //           // @ts-ignore
  //           const play = video.play();
  //           play
  //             .then((test: any) => {
  //               // scope.initOpencv();
  //             })
  //             .catch((err: any) => {
  //               console.log(err);
  //             });
  //         }
  //       })
  //       .catch(function (err) {
  //         console.log('An error occurred! ' + err);
  //       });
  //   }
  // }

  @ViewChild('svg') svg: ElementRef | undefined;
  @ViewChild('path') path: ElementRef | undefined;
  @ViewChild('cameraPreview') cameraPreview: ElementRef | undefined;
  private playing: boolean = true;
  parentHeight: number = 0;
  parentWidth: number = 0;
  private camera: any = null;

  @HostListener('window:resize', ['$event'])
  onResize() {
    this.updateParentSize();
  }

  private updateParentSize() {
    this.parentHeight = this.cameraPreview?.nativeElement.offsetHeight;
    this.parentWidth = this.cameraPreview?.nativeElement.offsetWidth;
  }

  ngAfterViewInit() {
    this.updateParentSize();
  }

  ngOnDestroy() {
    this.playing = false;
  }

  height: number = 0;
  width: number = 0;
  currentFps: number = 0;
  coordinates: any = null;
  private _coordinatesPercent: any = null;
  private frame: any = null;
  loading: boolean = false;

  coordinatesToPercent(coordinates: any) {
    if (!coordinates) {
      return;
    }
    this.coordinatesPercent = coordinates.map((coordinate: any) => {
      return {
        x: (coordinate.x / this.width) * 100,
        y: (coordinate.y / this.height) * 100,
      };
    });
  }

  getPath() {
    let result = '';
    if (!this._coordinatesPercent) {
      return '';
    }
    for (const coordinate of this._coordinatesPercent) {
      result += `${coordinate.x},${coordinate.y} `;
    }
    return `M ${result.slice(0, -1)} Z`;
  }

  constructor(
    private ngxOpenCv: SubvisionCoreService,
    @Inject(DOCUMENT) document: Document,
    private router: Router,
    private plastronService: PlastronService,
    private filesService: FilesService
  ) {
    this.filesService.clearSession();
  }

  initOpencv() {
    // subscribe to status of OpenCV module
    this.ngxOpenCv.cvState.subscribe((cvState: OpenCVState) => {
      if (cvState.error) {
        // handle errors
        console.log('error');
      } else if (cvState.loading) {
        // e.g. show loading indicator
        console.log('loading');
      } else if (cvState.ready) {
        // do image processing stuff
        console.log('ready');
        this.playing = true;
        this.startWebcam();
      }
    });
  }

  startWebcam() {
    console.log('startWebcam');
    const cv = this.plastronService.cv;

    let frame: any = null;
    if (this.plastronService.getFrame()) {
      frame = this.plastronService.getFrame();
    } else {
      frame = new cv.Mat(this.height, this.width, cv.CV_8UC4);
    }
    const fps = 24;
    const scope = this;

    let currentFps = 0;
    let currentTimestamp = new Date().getTime();

    function processVideo() {
      if (new Date().getTime() - currentTimestamp > 1000) {
        scope.currentFps = currentFps;
        currentFps = 0;
        currentTimestamp = new Date().getTime();
      } else {
        currentFps += 1;
      }

      if (!scope.playing) {
        return;
      }
      try {

      } catch (err) {
        console.log(err);
      }

      setTimeout(processVideo, 1000 / fps);
    }

    // schedule the first one.
    setTimeout(processVideo, 0);
  }

  _base64ToImageData(buffer: string, width: number, height: number) {
    return new Promise((resolve) => {
      var image = new Image();
      image.addEventListener('load', function (e: Event) {
        var canvasElement = document.createElement('canvas');
        canvasElement.width = width;
        canvasElement.height = height;
        var context = canvasElement.getContext('2d');
        // @ts-ignore
        context.drawImage(
          e.target as HTMLImageElement,
          0,
          0,
          image.naturalWidth,
          image.naturalHeight
        );

        // @ts-ignore
        resolve(
          context?.getImageData(0, 0, image.naturalWidth, image.naturalHeight)
        );
      });
      image.src = 'data:image/png;base64,' + buffer;
      image.style.display = 'none';
      document.body.appendChild(image);
      setTimeout(() => {
        document.body.removeChild(image);
      }, 1);
    });
  }
}
