import { CustomWiki } from './CustomWiki.js';

document.addEventListener('DOMContentLoaded', () => {
    const app = new CustomWiki('http://localhost:5073/api');
    app.render();
});