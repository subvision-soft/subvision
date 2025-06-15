import {Component, OnDestroy, ViewChild} from '@angular/core';
import {CommonModule} from '@angular/common';
import {OpencvImshowData, OpencvImshowService,} from '../../services/opencv-imshow.service';
import {SubvisionCoreService} from '../../../lib/subvision-core.service';
import {Subscription} from 'rxjs';

@Component({
  selector: 'app-opencv-imshow',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './opencv-imshow.component.html',
  styleUrl: './opencv-imshow.component.scss',
})
export class OpencvImshowComponent implements OnDestroy {
  ids: Set<string> = new Set();
  @ViewChild('container') container: any;

  subscriptions: Subscription[] = [];

  cv: any;

  constructor(
    private OpenCVImshowService: OpencvImshowService,
    private ngxOpenCVService: SubvisionCoreService
  ) {
    this.subscriptions.push(
      this.ngxOpenCVService.cvState.subscribe((state) => {
        if (state.ready) {
          // @ts-ignore
          this.cv = top['cv'];
          this.subscriptions.push(
            this.OpenCVImshowService.imageToShow.subscribe((data) => {
              if (data) {
                console.log('add canvas');
                this.addCanvas(data);
              }
            })
          );
        }
      })
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach((sub) => sub.unsubscribe());
  }

  addCanvas(data: OpencvImshowData) {
    let image = data.image?.clone();

    const size = new this.cv.Size(300, 300);
    if (this.ids.has(data.id)) {
      console.log('already exists');
      this.cv.resize(image, image, size);
      this.cv.imshow(data.id, image);
      image.delete();
      return;
    }
    this.ids.add(data.id);
    const canvas = document.createElement('canvas');
    canvas.width = 300;
    canvas.height = 300;
    canvas.id = data.id;
    const div = document.createElement('div');
    const label = document.createElement('label');
    label.innerHTML = data.title;
    div.appendChild(label);
    div.appendChild(canvas);
    div.classList.add('opencv-imshow');
    this.container.nativeElement.appendChild(div);
    const clone = image.clone();

    this.cv.resize(clone, clone, size);
    this.cv.imshow(canvas.id, clone);
    clone.delete();
  }
}
