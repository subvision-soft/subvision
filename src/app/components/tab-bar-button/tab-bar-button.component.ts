import {Component, Input} from '@angular/core';
import {RippleDirective} from '../../directives/ripple.directive';
import {RouterLink, RouterLinkActive} from '@angular/router';
import {NgIcon} from '@ng-icons/core';

@Component({
  selector: '[tabBarButton]',
  templateUrl: './tab-bar-button.component.html',
  styleUrls: ['./tab-bar-button.component.scss'],
  standalone: true,

  imports: [RippleDirective, RouterLink, RouterLinkActive, NgIcon],
})
export class TabBarButtonComponent {
  @Input() icon: string = '';
  @Input() label: string = '';
  @Input() link: string = '';
  @Input() active?: boolean = false;
}
