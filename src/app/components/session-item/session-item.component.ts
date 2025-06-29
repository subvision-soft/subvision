import {Component, HostBinding, Input} from '@angular/core';
import {FileInfo} from '@capacitor/filesystem';
import {FilesService} from '../../services/files.service';
import {Session} from '../../models/session';
import {RippleDirective} from '../../directives/ripple.directive';
import {DatePipe, NgIf} from '@angular/common';
import {NgIcon} from '@ng-icons/core';
import {LogoComponent} from '../logo/logo.component';

@Component({
  selector: '[sessionItem]',
  templateUrl: './session-item.component.html',
  styleUrls: ['./session-item.component.scss'],
  hostDirectives: [RippleDirective],
  standalone: true,
  host: {
    class: 'small-round fill',
  },
  imports: [NgIf, NgIcon, LogoComponent, DatePipe],
})
export class SessionItemComponent {
  get file(): FileInfo | undefined {
    return this._file;
  }

  session: Session | undefined;

  private _url: string | undefined;

  @Input() showPath: boolean = false;

  @Input() showLogo: boolean = false;

  @Input()
  set file(value: FileInfo | undefined) {
    if (value?.type === 'file') {
      this.filesService.openFileByFile(value).then((result) => {
        this.session = result;
      });
    }
    this._file = value;
  }

  @Input()
  set url(value: string | undefined) {
    if (value) {
      this.filesService.openFileByUrl(value).then((result) => {
        this.session = result;
      });
    }
    this._url = value;
  }

  get url(): string | undefined {
    return this._url;
  }

  constructor(private filesService: FilesService) {
  }

  private _file: FileInfo | undefined;
  @Input() goBack: boolean = false;
  @HostBinding('class.selected') private _selected: boolean = false;
  get selected(): boolean {
    return this._selected;
  }

  @Input()
  set selected(value: boolean) {
    this._selected = value;
  }

  protected readonly console = console;
}
