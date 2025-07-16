import "./edit.css";
import "../common.css";
import Edit from "./Edit.svelte";
import { mount } from "svelte";

const app = mount(Edit, {
    target: document.body,
});

export default app;
