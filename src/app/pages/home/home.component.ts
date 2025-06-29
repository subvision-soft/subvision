import {Component, ElementRef, ViewChild} from '@angular/core';
import {FilesService} from '../../services/files.service';
import {HistoryService} from '../../services/history.service';
import {Router, RouterLink} from '@angular/router';
import {RSSParserService} from '../../services/rss-parser.service';
import {TagComponent} from '../../components/tag/tag.component';
import {SessionItemComponent} from '../../components/session-item/session-item.component';
import {EmptyTextComponent} from '../../components/empty-text/empty-text.component';
import {TranslateModule} from '@ngx-translate/core';
import {RippleDirective} from '../../directives/ripple.directive';
import {LoadingComponent} from '../../components/loading/loading.component';
import {DatePipe, NgForOf, NgIf} from '@angular/common';
import {LogoComponent} from '../../components/logo/logo.component';
import {HeaderComponent} from '../../components/header/header.component';
import {HttpClient} from '@angular/common/http';
import {EndpointsUtils} from '../../utils/EndpointsUtils';
import {iconoirGithub} from '@ng-icons/iconoir';
import {ButtonComponent} from '../../components/button/button.component';
import {Actuality} from '../../models/actuality';
import {ParametersService} from '../../services/parameters.service';
import {NgIcon} from '@ng-icons/core';
import {TabBarComponent} from '../../components/tab-bar/tab-bar.component';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss'],
  standalone: true,
  imports: [
    TagComponent,
    SessionItemComponent,
    EmptyTextComponent,
    TranslateModule,
    RippleDirective,
    LoadingComponent,
    NgIf,
    LogoComponent,
    HeaderComponent,
    RouterLink,
    NgForOf,
    ButtonComponent,
    DatePipe,
    NgIcon,
    TabBarComponent,
  ],
})
export class HomeComponent {
  open: boolean = false;
  @ViewChild('app-page', {static: true}) el: ElementRef | undefined;

  actualitesLoading: boolean = true;

  actualites: Actuality[] = [];

  private readonly _url =
    'https://createfeed.fivefilters.org/extract.php?url=https%3A%2F%2Ftirsub.ffessm.fr%2F&item=.commissionpage-news-slider-slide&item_title=.commissionpage-news-slider-slide-caption-title&item_date=.post-date&item_date_format=d%2Fm%2FY+H%3Ai&item_image=.commissionpage-news-slider-slide-image%3Eimg&max=5&order=document&guid=0';

  toLocalDate(date: Date) {
    return new Date(date).toLocaleDateString('fr');
  }

  getMediaSource(feedItem: any) {
    return feedItem['media:content'][0]['$']['url'];
  }

  constructor(
    private historyService: HistoryService,
    private router: Router,
    private filesService: FilesService,
    private rssParserService: RSSParserService,
    private httpClient: HttpClient
  ) {

    fetch(EndpointsUtils.getPathNews()).then(
      (response) => response.json()
    ).then(
      (data: any) => {
        this.actualites = data;
        this.actualitesLoading = false;
      }
    ).catch(
      (error) => {
        console.error('Error fetching news:', error);
        this.actualitesLoading = false;
      }
    )
    filesService.clearSession();
  }

  get seances(): string[] {
    return this.historyService.history
      .sort((a, b) => {
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      })
      .map((history) => history.url)
      .slice(0, 6);
  }


  openSession(url: string) {
    this.router
      .navigate(['/sessions/session', {url: url}], {
        queryParams: {
          url: url,
        },
      })
      .then((r) => console.log(r));
  }

  protected readonly console = console;

  openActualite(actualite: Actuality) {
    this.router.navigate(['/actuality'], {
      state: actualite
    });
  }

  protected readonly ParametersService = ParametersService;
  protected readonly iconoirGithub = iconoirGithub;
}
