import "./view/view.css";
import "./edit/edit.css";
import "./common.css";
import Main from "./Main.svelte";
import { mount } from "svelte";

const app = mount(Main, {
    target: document.body,
});

export default app;
