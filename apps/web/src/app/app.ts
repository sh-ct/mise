import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { APP_NAME } from './app-name';

@Component({
  imports: [RouterOutlet],
  selector: 'mise-root',
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  protected readonly appName = APP_NAME;
}
