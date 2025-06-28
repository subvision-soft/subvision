import {Component, computed, HostBinding, signal} from '@angular/core';
import {TranslateService} from '@ngx-translate/core';
import {ParametersService} from './services/parameters.service';
import {NavigationEnd, Router, RouterOutlet} from '@angular/router';
import {ToastComponent} from './components/toast/toast.component';
import {TabBarComponent} from './components/tab-bar/tab-bar.component';
import {HttpClient} from '@angular/common/http';
import {SplashScreenComponent} from './components/splash-screen/splash-screen.component';
import {EndpointsUtils} from './utils/EndpointsUtils';
import {ContainerComponent} from './components/container/container.component';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
  standalone: true,
  providers: [TranslateService],
  imports: [RouterOutlet, ToastComponent, TabBarComponent, SplashScreenComponent, ContainerComponent],
})
export class AppComponent {
  title = 'subvision';
  @HostBinding('style.background-color') backgroundColor: string =
    'var(--theme-color-2-5)';
  tabs: any[] = [];
  cssVariables: string = '';
  settingsLoaded = signal(false);
  visionTokenRetrieved = signal(true);

  showSplashScreen = computed(() => {
      return !this.settingsLoaded() || !this.visionTokenRetrieved();
    }
  );

  constructor(
    private translate: TranslateService,
    private parametersService: ParametersService,
    private router: Router,
    private http: HttpClient,
  ) {
    this.parametersService.loaded.subscribe((loaded: boolean) => {
      this.settingsLoaded.set(loaded);
      if (loaded) {
        fetch(EndpointsUtils.getPathGenToken(), {redirect: "follow"})
          .then((res) => res.json())
          .then(res => {
            localStorage.setItem('token', res?.token);
            this.visionTokenRetrieved.set(true);
          })
        this.translate.addLangs(ParametersService.langs);
        this.translate.setDefaultLang('fr-FR');
        this.translate.use(ParametersService.get('LANGUE').value);
      }
    });

    router.events.subscribe((ev) => {
      if (ev instanceof NavigationEnd) {
        if (ev.urlAfterRedirects.includes('camera/preview')) {
          this.backgroundColor = 'transparent';
        } else {
          this.backgroundColor = 'var(--theme-color-2-5)';
        }
      }
    });
  }
}
