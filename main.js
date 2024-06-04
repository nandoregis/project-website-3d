import Viewer from "./viewer.js";

const main = document.querySelectorAll('.main');

for(let i = 0; i < main.length; i++) {
    const view = new Viewer(main[i]);
}

