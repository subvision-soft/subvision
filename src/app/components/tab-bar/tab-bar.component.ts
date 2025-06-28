import {Component, EventEmitter, Output} from '@angular/core';
import {iconoirHome} from '@ng-icons/iconoir';
import {Router, RouterLink, RouterLinkActive} from '@angular/router';
import {TabBarButtonComponent} from '../tab-bar-button/tab-bar-button.component';
import {NgForOf} from '@angular/common';
import {ParametersService} from '../../services/parameters.service';

class Tab {
  active?: boolean = false;
  link: string = '';
  label: string = '';
  icon: string = '';
  button?: boolean = false;
  hidden: boolean | (() => boolean) = false;
}

@Component({
  selector: '[tabBar]',
  templateUrl: './tab-bar.component.html',
  styleUrls: ['./tab-bar.component.scss'],
  standalone: true,
  imports: [TabBarButtonComponent, NgForOf, RouterLink, RouterLinkActive],
})
export class TabBarComponent {
  tabs: Tab[] = [
    {icon: 'home', label: 'Accueil', link: '/home', hidden: false},
    {icon: 'camera', label: 'Caméra', link: '/camera', hidden: false, button: true},
    {
      icon: 'folder', label: 'Sessions', link: '/sessions', hidden: () => {
        return !ParametersService.isLocalSave()
      }
    },
    {
      icon: 'groups', label: 'Tireurs', link: '/users', hidden: () => {
        return !ParametersService.isLocalSave()
      }
    },
    {icon: 'settings', label: 'Paramètres', link: '/settings', hidden: false},
  ];
  @Output() select = new EventEmitter<Tab>();

  protected readonly iconoirHome = iconoirHome;

  constructor(private router: Router) {
    router.events.subscribe(() => {
      this.updateActive();
    });
  }

  getTabs(): Tab[] {
    return this.tabs.filter(tab => !tab.hidden || (typeof tab.hidden === 'function' && !tab.hidden()));
  }

  private updateActive() {
    const path = this.router.url;

    this.tabs.forEach((tab) => {
      tab.active = path.startsWith(tab.link);
      if (tab.active) {
        this.select.emit(tab);
      }
    });
  }
}
