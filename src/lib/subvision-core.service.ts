import {Injectable, NgZone} from '@angular/core';
import {BehaviorSubject} from 'rxjs';
import {OpenCVState} from './models';
import SubvisionCVModule from '../assets/subvision-core/subvision_core';

@Injectable({
  providedIn: 'root',
})
export class SubvisionCoreService {
  cvState = new BehaviorSubject<OpenCVState>({
    ready: false,
    error: false,
    loading: false,
    state: '',
  });
  instance: {
    getSheetCoordinates: (width: number, height: number, data: Uint8ClampedArray) => any;
    processTargetImage: (width: number, height: number, data: Uint8ClampedArray) => any;
  };


  constructor(private _ngZone: NgZone) {
    if (this.cvState.value.loading) {
      return;
    }
    this.loadOpenCv();
  }

  /**
   * load the OpenCV script
   */
  loadOpenCv() {
    if (this.cvState.value.ready || this.cvState.value.loading) {
      return;
    }
    this.cvState.next(this.newState('loading'));
    SubvisionCVModule().then((module: { getSheetCoordinates: any; processTargetImage: any; }) => {
      this.instance = {
        getSheetCoordinates: module.getSheetCoordinates,
        processTargetImage: module.processTargetImage,
      };
      console.log('OpenCV module loaded');
      this.cvState.next(this.newState('ready'));
    }).catch(((err: any) => {
      console.error('Failed to load OpenCV module:', err);
      this.cvState.next(this.newState('error'));
      this.cvState.error(err);
    }));

  }

  /**
   * generates a new state object
   * @param change - the new state of the module
   */
  private newState(change: 'loading' | 'ready' | 'error'): OpenCVState {
    const newStateObj: OpenCVState = {
      ready: false,
      loading: false,
      error: false,
      state: '',
    };
    Object.keys(newStateObj).forEach((key) => {
      if (key !== 'state') {
        if (key === change) {
          newStateObj[key] = true;
          newStateObj.state = key;
        }
        // else {
        //   newStateObj[key] = false;
        // }
      }
    });
    return newStateObj;
  }

}
