import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

/** Root: each top-level route brings its own layout (the signed-in shell, or the bare sign-in pages). */
@Component({
  selector: 'mise-root',
  imports: [RouterOutlet],
  template: '<router-outlet />',
})
export class App {}
