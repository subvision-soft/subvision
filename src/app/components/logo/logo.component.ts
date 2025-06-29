import {Component, HostBinding, Input} from '@angular/core';

@Component({
  selector: '[appLogo]',
  templateUrl: './logo.component.html',
  styleUrls: ['./logo.component.scss'],
  host: {
    height: "150",
    id: "svg1",
    version: "1.1",
    viewBox: "0 0 150 150",
    width: "150",
    xmlns: "http://www.w3.org/2000/svg",
  },
  standalone: true,
})
export class LogoComponent {
  @HostBinding('style.width') width: string = '40px';

  @Input() set size(size: number) {
    this.width = `${size}px`;
  }
}
