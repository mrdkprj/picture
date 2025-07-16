import "./main.css";
import "../common.css";
import Viewer from "./Viewer.svelte";
import { mount } from "svelte";

const app = mount(Viewer, {
    target: document.body,
});

export default app;
