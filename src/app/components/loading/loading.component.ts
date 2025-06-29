import {Component, HostBinding, Input} from '@angular/core';

@Component({
  selector: 'app-loading',
  templateUrl: './loading.component.html',
  styleUrls: ['./loading.component.scss'],
  host: {
    // '[hidden]': 'loading',
    class: 'surface center-align middle-align vertical',
  },
  standalone: true,
})
export class LoadingComponent {
  @Input() @HostBinding('class.loading') loading: boolean = false;
}
