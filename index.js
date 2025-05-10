import * as THREE from "three";
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

class PageControl {
    constructor() {
        this.SG = new StatueGenerator();

        this.brightness = 100;
        this.contrast = 100;
        this.saturation = 100;
        this.merge_second_layer = false;
        this.file = null;
        this.save_name = null;
        this.dragging_from = null;

        this.block_mesh_cache = {};
        this.output_renderer = null;
        this.output_scene = null;
        this.output_camera = null;
        this.output_orbit = null;

        this.input_renderer = null;
        this.input_scene = null;
        this.input_camera = null;
        this.input_orbit = null;

        this.model_type();
        this.image_preprocessing();
        this.file_input();
        this.versions();
        this.distance_function();
        this.ignore_pixels();
        this.block_iterate_options();
        this.export();
        this.output_preview();
        this.input_preview();
    }

    model_type() {
        let e = document.getElementById("model_type");
        let get_model = this.SG.get_model();
        for (let value of get_model[0]) {
            let c = document.createElement("option");
            c.innerHTML = value;
            e.appendChild(c);
        }
        e.value = get_model[1];

        e.addEventListener("change", (event) => {
            this.SG.set_model(event.target.value);
            this._input_preview_update();
            this.elements();
        })
        this._make_options_scrollable(e);
        e.dispatchEvent(new Event("change"));
    }

    _display_warning(message) {
        function remove_warning() {
            e.style.transition = 500 + "ms";
            e.style.opacity = 0;

            setTimeout(() => {e.remove()}, 500);
        }

        let warnings = document.getElementById("warnings");

        let e = document.createElement("div");
        warnings.appendChild(e);

        let inside = document.createElement("div");
        e.appendChild(inside);

        let span = document.createElement("span");
        span.innerHTML = message;
        inside.appendChild(span);

        let close = document.createElement("button");
        close.innerHTML = "✕";
        close.addEventListener("click", remove_warning);
        inside.appendChild(close);
        
        setTimeout(remove_warning, 5000);
    }

    _make_slider(slider, value) {
        let s = document.getElementById(slider);
        let v = document.getElementById(value);
        let default_value = s.value;

        s.addEventListener("input", (event) => {
            v.value = event.target.value;
        })
        v.addEventListener("input", (event) => {
            s.value = event.target.value;
        })
        s.addEventListener("change", () => {
            v.dispatchEvent(new Event("change"));
        })
        s.addEventListener("dblclick", () => {
            s.value = default_value;
            v.value = default_value;
            v.dispatchEvent(new Event("change"));
        })
    }

    _make_options_scrollable(options) {
        options.addEventListener("wheel", (event) => {
            if (event.deltaY === 0) {
                return;
            }
            event.preventDefault();

            let value_before = event.target.selectedIndex;
            if (event.deltaY > 0) {
                event.target.selectedIndex = Math.min(event.target.selectedIndex+1, event.target.length-1);
            } else {
                event.target.selectedIndex = Math.max(event.target.selectedIndex-1, 0);
            }
            if (event.target.selectedIndex === value_before) {
                return;
            }
            event.target.dispatchEvent(new Event("change"));
        }) 
    }

    image_preprocessing() {
        this._make_slider("brightness_slider", "brightness_value");
        this._make_slider("contrast_slider", "contrast_value");
        this._make_slider("saturation_slider", "saturation_value");

        document.getElementById("brightness_value").addEventListener("change", (event) => {
            this.brightness = Number(event.target.value);
            this._apply_image();
        })
        document.getElementById("contrast_value").addEventListener("change", (event) => {
            this.contrast = Number(event.target.value);
            this._apply_image();
        })
        document.getElementById("saturation_value").addEventListener("change", (event) => {
            this.saturation = Number(event.target.value);
            this._apply_image();
        })
        document.getElementById("merge_second_layer").addEventListener("change", (event) => {
            this.merge_second_layer = event.target.checked;
            this._apply_image();
        })
    }

    async _apply_image() {
        if (this.file === null) {
            return;
        }

        let self = this;
        async function _load_image(file) {
            if (!file) {
                return;
            }
            let canvas = document.createElement('canvas');
            let ctx = canvas.getContext('2d', {willReadFrequently: true});
            ctx.filter = `brightness(${self.brightness/100}) contrast(${self.contrast/100}) saturate(${self.saturation/100})`;
            async function load_image() {
                return new Promise(function (resolve) {
                    let im = new Image();
          
                    im.src = URL.createObjectURL(file);
                    im.onload = function() {
                        ctx.drawImage(im, 0, 0);
                        resolve([im.width, im.height]);
                    }
                })
            }
            let image_size = await load_image();

            // if its old skin type: convert it into new skin type
            if (image_size[0] === 64 && image_size[1] === 32) {
                image_size = [64, 64];
                let modifications = [[4, 16, 4, 4, 20, 48],
                                     [8, 16, 4, 4, 24, 48],
                                     [0, 20, 4, 12, 24, 52],
                                     [4, 20, 4, 12, 20, 52],
                                     [8, 20, 4, 12, 16, 52],
                                     [12, 20, 4, 12, 28, 52],
                                     [44, 16, 4, 4, 36, 48],
                                     [48, 16, 4, 4, 40, 48],
                                     [40, 20, 4, 12, 40, 52],
                                     [44, 20, 4, 12, 36, 52],
                                     [48, 20, 4, 12, 32, 52],
                                     [52, 20, 4, 12, 44, 52]]
                for (let o of modifications) {
                    let d = ctx.getImageData(o[0], o[1], o[2], o[3]);
                    let all_rows = [];
                    for (let y = 0; y < o[2]*o[3]*4; y = y+(4*o[2])) {
                        let current_row = [];
                        for (let x = 0; x < o[2]*4; x = x+4) {
                            current_row.push([d.data[x+y+0], d.data[x+y+1], d.data[x+y+2], d.data[x+y+3]])
                        }
                        all_rows = all_rows.concat(current_row.reverse());
                    }
                    let new_data = [];
                    for (let o of all_rows) {
                        new_data = new_data.concat(o);
                    }
                    new_data = new ImageData(new Uint8ClampedArray(new_data), o[2], o[3]);
                    ctx.putImageData(new_data, o[4], o[5]);
                }
            }

            if (self.merge_second_layer) {
                let modifications = [[32, 0, 32, 16, 0, 0],
                                     [0, 32, 16, 16, 0, 16],
                                     [16, 32, 24, 16, 16, 16],
                                     [40, 32, 16, 16, 40, 16],
                                     [0, 48, 16, 16, 16, 48],
                                     [48, 48, 16, 16, 32, 48]]
                for (let o of modifications) {
                    let img = ctx.getImageData(o[0], o[1], o[2], o[3]);
                    img = await createImageBitmap(img);
                    ctx.drawImage(img, o[4], o[5]);
                }
            }

            return [image_size, canvas, ctx];
        }

        let [image_size, canvas, ctx] = await _load_image(this.file);
        this.SG.set_image(ctx.getImageData(0, 0, image_size[0], image_size[1]));
        this._output_preview_update();
        this._input_preview_update();
    }

    file_input() {
        let self = this;

        async function get_image_from_ign(ign) {
            ign = ign.trim();

            if (ign.length === 0) {
                self._display_warning("Username has to have at least 1 character");
                return null;
            }

            if (!/^[a-zA-Z0-9_]{1,16}$/.test(ign)) {
                self._display_warning("Invalid Username.");
                return null;
            }

            let f = await fetch("https://crafthead.net/skin/" + ign);
            if (f.status !== 200) {
                self._display_warning("Fetching texture failed.");
                return null;
            }

            return await f.blob();
        }


        let image_file = document.getElementById("image_file");
        image_file.addEventListener("change", async (event) => {
            // if file was already set, chrome removes file if cancel was clicked on file prompt and fires change event
            if (image_file.files.length === 0) {
                return;
            }
            document.getElementById("username_input").value = "";
            this.file = image_file.files[0];
            this.save_name = image_file.files[0]["name"];
            this.save_name = this.save_name.match(/^.*?(?=(?:\.(?!.*\.))|$)/);
            await this._apply_image();
        })

        let username_input = document.getElementById("username_input");
        let submit_button = document.getElementById("submit_button");

        username_input.addEventListener("keypress", (event) => {
            if (event.key === "Enter") {
                submit_button.dispatchEvent(new Event("click"));
            }
        })

        submit_button.addEventListener("click", async () => {
            let file = await get_image_from_ign(username_input.value);
            if (file === null) {
                return;
            }
            this.file = file;
            image_file.value = "";
            this.save_name = username_input.value;
            await this._apply_image();
        })


    }

    versions() {
        let e = document.getElementById("version");
        let get_version = this.SG.get_version();
        for (let v of get_version[0]) {
            let c = document.createElement("option");
            c.innerHTML = v;
            e.appendChild(c);
        }
        e.value = get_version[1];

        e.addEventListener("change", (event) => {
            this.SG.set_version(event.target.value);
            this._output_preview_update();
            this.palette();
        })
        this._make_options_scrollable(e);
        e.dispatchEvent(new Event("change"));
    }

    distance_function() {
        let e = document.getElementById("distance_function");
        let get_distance_function = this.SG.get_distance_function();
        for (let v of get_distance_function[0]) {
            let c = document.createElement("option");
            c.innerHTML = v;
            e.appendChild(c);
        }
        e.value = get_distance_function[1];

        e.addEventListener("change", (event) => {
            this.SG.set_distance_function(event.target.value);
            this._output_preview_update();
        })
        this._make_options_scrollable(e);
        e.dispatchEvent(new Event("change"));
    }

    ignore_pixels() {
        function merge_method(values, ignore_below) {
            for (let x of values) {
                if (x["a"] === undefined) {
                    continue;
                }
                if (x["a"] < ignore_below) {
                    continue;
                }
                return x;
            }
        }

        this._make_slider("ignore_pixels_slider", "ignore_pixels_value");
        let ignore_pixels_value = document.getElementById("ignore_pixels_value");
        ignore_pixels_value.addEventListener("change", (event) => {
            let v = Number(event.target.value);
            this.SG.set_merge_method((values) => {
                return merge_method(values, v);
            })
            this._output_preview_update();
        })
        ignore_pixels_value.dispatchEvent(new Event("change"));

    }

    _palette_changed() {
        let e = document.getElementById("palette");
        let selected_blocks = [];
        
        for (let c of e.childNodes) {
            let checkbox = c.getElementsByTagName("summary")[0].getElementsByTagName("input")[0];
            if (!checkbox.checked) {
                continue;
            }
            
            for (let block of c.getElementsByTagName("div")) {
                let input = block.getElementsByTagName("input")[0];
                
                if (input.checked) {
                    selected_blocks.push(block.dataset.uuid);
                }
            }
        }
        this.SG.set_palette(selected_blocks);
        this._output_preview_update();
    }

    _drag_checkbox_switch(element_list, on_change) {
        let dragmousedown = false;
        let switch_to = null;

        function end_checkbox_drag() {
            dragmousedown = false;
            switch_to = null;
            document.removeEventListener("mouseup", end_checkbox_drag);
            on_change();
        }

        for (let element of element_list) {
            element.addEventListener("mouseover", (event) => {
                if (dragmousedown === false || switch_to === null) {
                    return;
                }
                if (event.target.checked !== switch_to) {
                    event.target.checked = switch_to;
                    event.target.dispatchEvent(new Event("change"));
                }
            })
            element.addEventListener("mousedown", (event) => {
                switch_to = !event.target.checked;
                event.target.checked = switch_to;
                event.target.dispatchEvent(new Event("change"));
                dragmousedown = true;

                document.addEventListener("mouseup", end_checkbox_drag);
            })
            element.addEventListener("click", (event) => {
                event.preventDefault();
            })
        }
    }

    palette() {
        let e = document.getElementById("palette");
        e.innerHTML = "";
        let button_list = [];
        let category_list = [];

        function check_indeterminate(details_element) {
            let checkbox = details_element.getElementsByTagName("summary")[0].getElementsByTagName("input")[0];
            if (!checkbox.checked) {
                checkbox.indeterminate = false;
                return;
            }
            for (let div of details_element.getElementsByTagName("div")) {
                if (!div.getElementsByTagName("input")[0].checked) {
                    checkbox.indeterminate = true;
                    return;
                }
            }
            checkbox.indeterminate = false;
        }

        for (let category of this.SG.get_palette()) {
            let cat = document.createElement("details");
            let head = document.createElement("summary");

            let b = document.createElement("input");
            b.type = "checkbox";
            b.checked = true;
            category_list.push(b);
            b.addEventListener("change", (event) => {
                event.target.parentElement.parentElement.classList.toggle("disabled", !event.target.checked);
                check_indeterminate(event.target.parentElement.parentElement);
            })
            head.appendChild(b);

            b = document.createElement("span");
            b.innerHTML = category[0];
            head.appendChild(b);

            cat.appendChild(head);

            for (let member of category[1]) {
                let mem = document.createElement("div");
                mem.dataset.uuid = member["uuid"];

                let image = document.createElement("img");
                image.src = member["texture"];
                image.draggable = false;
                mem.appendChild(image);

                let button = document.createElement("input");
                button.type = "checkbox";
                button.checked = true;
                button.addEventListener("change", (event) => {
                    check_indeterminate(event.target.parentElement.parentElement);
                })
                button_list.push(button);

                mem.appendChild(button);

                let text = document.createElement("span");
                text.innerHTML = member["name"];
                mem.appendChild(text);

                mem.appendChild(document.createElement("br"));

                cat.appendChild(mem);
            }
            e.appendChild(cat);
        }

        this._drag_checkbox_switch(button_list, () => {this._palette_changed()});
        this._drag_checkbox_switch(category_list, () => {this._palette_changed()});
        this._palette_changed();
    }

    block_iterate_options() {
        let reduce_blocks = document.getElementById("reduce_blocks");
        reduce_blocks.addEventListener("change", () => {
            this.SG.set_reduce_blocks(reduce_blocks.checked);
            this._output_preview_update();
        })
        let add_string = document.getElementById("add_string");
        add_string.addEventListener("change", () => {
            this.SG.set_add_string(add_string.checked);
            this._output_preview_update();
        })
        this.SG.set_reduce_blocks(reduce_blocks.checked);
        this.SG.set_add_string(add_string.checked);
    }

    _elements_changed() {
        function traverse_list(html_node, output_array) {
            for (let li of html_node.childNodes) {
                let checkbox = li.firstElementChild.firstElementChild.firstElementChild;
                if (!checkbox.checked) {
                    continue;
                }
                let ul = li.firstElementChild.querySelector("ul");
                if (ul !== null) {
                    traverse_list(ul, output_array);
                } else {
                    output_array.push(checkbox.dataset.uuid);
                }
            }
        }

        let e = document.getElementById("model_elements");
        let all_uuids = [];
        traverse_list(e, all_uuids);
        
        this.SG.set_model_order(all_uuids);
        this.SG.set_model_elements(all_uuids);
        this._output_preview_update();
    }

    elements() {
        let self = this;

        function where_it_is(event) {
            let area = self.dragging_from.parentElement.parentElement.parentElement.parentElement;
            let bounds = [area.offsetLeft, area.offsetTop, area.offsetLeft+area.offsetWidth, area.offsetTop+area.offsetHeight];
            if (event.x < bounds[0] || event.y < bounds[1] || event.x > bounds[2] || event.y > bounds[3]) {
                return [null, false];
            }

            let sub_bounds = Array.from(area.childNodes).map((v) => {return (v.offsetTop+v.offsetTop+v.offsetHeight)/2});
            sub_bounds = sub_bounds.map((v) => {return event.y-v});

            let i = sub_bounds.map((v) => {return Math.abs(v)});
            i = i.indexOf(Math.min(...i));

            return [i, sub_bounds[i] > 0];
        }

        function draggable_span(span) {
            span.classList.add("unselectable");
            let li = span.parentElement.parentElement.parentElement;
            let ul = li.parentElement;

            let span_copy = document.createElement("span");
            span_copy.innerHTML = span.innerHTML;
            span_copy.classList.add("dragging_preview");
            span_copy.style.position = "absolute";
            let is_dragging = false;
            let current_over = null;

            function on_mouse_move(event) {
                if (!is_dragging) {
                    document.body.appendChild(span_copy);
                    is_dragging = true;
                }
                span_copy.style.left = event.x + "px";
                span_copy.style.top = event.y + "px";
                
                let [index, side] = where_it_is(event);
                let mouse_at;
                if (index !== null) {
                    mouse_at = ul.childNodes[index];
                } else {
                    mouse_at = null;
                }

                if (current_over !== mouse_at) {
                    if (current_over !== null) {
                        current_over.classList.remove("dragging-over");
                    }
                    if (mouse_at !== null) {
                        mouse_at.classList.add("dragging-over");
                    }
                    current_over = mouse_at;
                }
                document.querySelector(":root").style.setProperty("--dragging-over-side", side ? 1 : -1);
            }

            function on_mouse_up(event) {
                document.removeEventListener("mouseup", on_mouse_up);
                document.removeEventListener("mousemove", on_mouse_move);
                if (is_dragging) {
                    document.body.removeChild(span_copy);
                    is_dragging = false;

                    let [i, side] = where_it_is(event);
                    if (i !== null) {
                        let where = side ? "afterend" : "beforebegin";
                        ul.childNodes[i].insertAdjacentElement(where, li);
                        self._elements_changed();
                    }
                }
                if (current_over !== null) {
                    current_over.classList.remove("dragging-over");
                }
            }

            span.addEventListener("mousedown", function() {
                self.dragging_from = this;
                document.addEventListener("mousemove", on_mouse_move);
                document.addEventListener("mouseup", on_mouse_up);
            })
        }

        function check_indeterminate(li_element) {
            let checkbox = li_element.getElementsByTagName("details")[0].getElementsByTagName("summary")[0].getElementsByTagName("input")[0];
            let ul = li_element.getElementsByTagName("details")[0].getElementsByTagName("ul")[0];

            if (ul !== undefined) {
                let indeterminate = false;
                if (checkbox.checked) {
                    for (let li of ul.childNodes) {
                        let current_checkbox = li.getElementsByTagName("summary")[0].getElementsByTagName("input")[0];
                        if (!current_checkbox.checked || current_checkbox.indeterminate) {
                            indeterminate = true;
                            break;
                        }
                    }
                }
                checkbox.indeterminate = indeterminate;
            }

            if (li_element.parentNode !== document.getElementById("model_elements")) {
                check_indeterminate(li_element.parentNode.parentNode.parentNode);
            }
        }

        function working_button(button) {
            button.type = "checkbox";
            button.checked = true;
            button.addEventListener("change", function() {
                let inside_this_list = this.parentNode.parentNode.parentNode;
                inside_this_list.classList.toggle("disabled", !this.checked);
                check_indeterminate(inside_this_list);
            })
        }

        function list(html_node, list_elements) {
            let button_list = [];
            for (let [name, sub_elements] of list_elements) {
                let li = document.createElement("li");
                if (["north", "west", "east", "south", "up", "down"].includes(name.toLowerCase())) {
                    li.classList.add("last-node");
                }
                let details = document.createElement("details");
                let summary = document.createElement("summary");
                let button = document.createElement("input");
                working_button(button);
                button_list.push(button);

                summary.appendChild(button);
                let span = document.createElement("span");
                span.innerHTML = (name[0].toUpperCase() + name.slice(1)).replace(/(?=(?!^)[A-Z])/g, " ");
                summary.appendChild(span);
                details.appendChild(summary);

                if (typeof(sub_elements) !== "string") {
                    let ul = document.createElement("ul");
                    list(ul, sub_elements);
                    details.appendChild(ul);
                } else {
                    button.dataset.uuid = sub_elements;
                }

                li.appendChild(details);
                html_node.appendChild(li);
                draggable_span(span);
            }

            self._drag_checkbox_switch(button_list, () => {self._elements_changed()});
        }

        let e = document.getElementById("model_elements");
        e.innerHTML = "";
        list(e, this.SG.get_model_elements());
        this._elements_changed();
    }

    _output_preview_update(camera_reset=false) {
        let self = this;
        let access_blocks;
        try {
            access_blocks = this.SG.access_blocks();
        } catch (er) {
            if (!er.message.startsWith("StatueGenerator error")) {
                throw er;
            }
            return;
        }

        function get_block(block_info) {
            if (block_info["uuid"] in self.block_mesh_cache) {
                return self.block_mesh_cache[block_info["uuid"]].clone();
            }
            if (block_info["texture"] === null) {
                return null;
            }

            let t = {};
            for (let [face, data_url] of Object.entries(block_info["texture"])) {
                let texture = new THREE.TextureLoader().load(data_url);
                texture.colorSpace = THREE.SRGBColorSpace;
                texture.magFilter = THREE.NearestFilter;
                texture = new THREE.MeshBasicMaterial({map: texture});
                t[face] = texture;
            }
            if (("top" in t) && !("bottom" in t)) {
                t["bottom"] = t["top"];
            } else if (!("top" in t) && ("bottom" in t)) {
                t["top"] = t["bottom"];
            } else if (!("top" in t) && !("bottom" in t)) {
                t["top"] = t["side"];
                t["bottom"] = t["side"];
            }
            t = [t["side"], t["side"], t["top"], t["bottom"], t["side"], t["side"]];
            let cube = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), t);
            self.block_mesh_cache[block_info["uuid"]] = cube;

            return cube;
        }

        let instanced_meshes = {};
        let instanced_meshes_count = {};
        for (let x of this.SG.access_block_count()) {
            if (x["texture"] === null) {
                continue;
            }
            instanced_meshes_count[x["uuid"]] = x["count"];
            let b = get_block(x);
            instanced_meshes[x["uuid"]] = new THREE.InstancedMesh(b.geometry, b.material, x["count"]);
        }

        camera_reset = camera_reset || (this.output_scene.children.length === 0);
        let output_scene = new THREE.Scene();
        output_scene.background = new THREE.Color(0x202020);

        let position_matrix = new THREE.Matrix4();
        for (let [pos, info] of Object.entries(access_blocks)) {
            if (info["texture"] === null) {
                continue;
            }
            pos = pos.split(",");
            pos = pos.map((v) => Number(v));
            position_matrix.setPosition(...pos);

            instanced_meshes_count[info["uuid"]] += -1;
            instanced_meshes[info["uuid"]].setMatrixAt(instanced_meshes_count[info["uuid"]], position_matrix);
        }

        for (let x of Object.values(instanced_meshes)) {
            output_scene.add(x);
        }
        for (let x of this.output_scene["children"]) {
            x.dispose();
        }
        this.output_scene = output_scene;

        if (camera_reset) {
            let box_help = new THREE.BoxHelper(this.output_scene);
            box_help.geometry.computeBoundingBox();
            let mid_point = box_help.geometry.boundingBox.min.clone();
            mid_point.add(box_help.geometry.boundingBox.max);
            mid_point.divideScalar(2);
            this.output_orbit.target = mid_point;
            this.output_camera.position.copy(mid_point);
            this.output_camera.position.z = -50;
        }

        let grid = new THREE.GridHelper(1000, 250, 0x404040, 0x404040);
        grid.position.add(new THREE.Vector3(0, 0.5, 0));
        output_scene.add(grid);

        this.output_materials();
    }

    output_preview() {
        let self = this;
        let e = document.getElementById("output_preview");
        let size = [400, 500];
        this.output_renderer = new THREE.WebGLRenderer({antialias: true});
        this.output_renderer.setPixelRatio(window.devicePixelRatio);
        this.output_renderer.setSize(...size);
        e.appendChild(this.output_renderer.domElement);

        this.output_camera = new THREE.PerspectiveCamera(75, size[0]/size[1]);
        this.output_orbit = new OrbitControls(this.output_camera, this.output_renderer.domElement);
        this.output_scene = new THREE.Scene();
        this.output_scene.background = new THREE.Color(0x202020);

        function animate() {
            self.output_renderer.render(self.output_scene, self.output_camera);
            self.output_orbit.update();
        }
        this.output_renderer.setAnimationLoop(animate);
        this._add_preview_controls(this.output_renderer, this.output_camera, size, "left", () => {self._output_preview_update(true)});
    }

    _input_preview_update(camera_reset=false) {
        let [image, width, height] = this.SG.access_image_url(true);
        let model_name = this.SG.access_model_name();
        if (image === null || model_name === null) {
            return;
        }
        let model = models[model_name];
        if (model_name in input_preview_models) {
            model = input_preview_models[model_name];
        }

        let self = this;
        camera_reset = camera_reset || (this.input_scene.children.length === 0);
        let scene = new THREE.Scene();
        scene.background = new THREE.Color(0x202020);

        new THREE.TextureLoader().load(image, (texture) => {
            texture.colorSpace = THREE.SRGBColorSpace;
            texture.magFilter = THREE.NearestFilter;

            for (let e of Object.values(model["elements"])) {
                let size = [e["to"][0]-e["from"][0], e["to"][1]-e["from"][1], e["to"][2]-e["from"][2]];

                if ("inflate" in e) {
                    size = [size[0]+(2*e["inflate"]), size[1]+(2*e["inflate"]), size[2]+(2*e["inflate"])];
                }

                let box = new THREE.BoxGeometry(...size);
                box.translate(size[0]/2, size[1]/2, size[2]/2);

                if ("rotation" in e) {
                    let pivot = [e["origin"][0]-e["from"][0], e["origin"][1]-e["from"][1], e["origin"][2]-e["from"][2]];
                    box.translate(-pivot[0], -pivot[1], -pivot[2]);

                    box.rotateX(e["rotation"][0]*(Math.PI/180));
                    box.rotateY(e["rotation"][1]*(Math.PI/180));
                    box.rotateZ(e["rotation"][2]*(Math.PI/180));

                    box.translate(pivot[0], pivot[1], pivot[2]);
                }

                if ("inflate" in e) {
                    box.translate(-e["inflate"], -e["inflate"], -e["inflate"]);
                }

                let materials = [];
                for (let facing of ["east", "west", "up", "down", "south", "north"]) {
                    let o = e["faces"][facing]["uv"];
                    let t = texture.clone();
                    t.offset.set(o[0]/width, (height-o[3])/height);
                    t.repeat.set((o[2]-o[0])/width, (o[3]-o[1])/height);

                    let mat = new THREE.MeshBasicMaterial({map: t, transparent: true, alphaTest: 0.01});
                    materials.push(mat);
                }

                let mesh = new THREE.Mesh(box, materials);
                mesh.position.set(...e["from"]);
                scene.add(mesh);
            }
            self.input_scene = scene;

            if (camera_reset) {
                let box_help = new THREE.BoxHelper(self.input_scene);
                box_help.geometry.computeBoundingBox();
                let mid_point = box_help.geometry.boundingBox.min.clone();
                mid_point.add(box_help.geometry.boundingBox.max);
                mid_point.divideScalar(2);
                this.input_orbit.target = mid_point;
                this.input_camera.position.copy(mid_point);
                this.input_camera.position.z = -50;
            }

            let grid = new THREE.GridHelper(1000, 250, 0x404040, 0x404040);
            scene.add(grid);
        })
    }

    input_preview() {
        let self = this;
        let e = document.getElementById("input_preview");
        let size = [360, 400];
        this.input_renderer = new THREE.WebGLRenderer();
        this.input_renderer.setPixelRatio(window.devicePixelRatio);
        this.input_renderer.sortObjects = false;
        this.input_renderer.setSize(...size);
        e.appendChild(this.input_renderer.domElement);

        this.input_camera = new THREE.PerspectiveCamera(75, size[0]/size[1]);
        this.input_orbit = new OrbitControls(this.input_camera, this.input_renderer.domElement);
        this.input_scene = new THREE.Scene();
        this.input_scene.background = new THREE.Color(0x202020);

        function animate() {
            self.input_renderer.render(self.input_scene, self.input_camera);
            self.input_orbit.update();
        }
        this.input_renderer.setAnimationLoop(animate);
        this._add_preview_controls(this.input_renderer, this.input_camera, size, "right", () => {self._input_preview_update(true)});
    }

    _add_preview_controls(renderer, camera, default_size, resize_side, on_view_reset) {
        let is_right = (resize_side === "right");
        let resize = document.createElement("button");
        resize.innerHTML = is_right ? "↘" : "↙";
        resize.classList.add("resize-button");
        renderer.domElement.parentElement.appendChild(resize);

        function resizing(event) {
            let size = renderer.getSize(new THREE.Vector2());
            size = [size["x"]+(event.movementX*(+is_right*2-1)), size["y"]+event.movementY];
            size = [Math.max(size[0], 50), Math.max(size[1], 50)];
            renderer.setSize(size[0], size[1]);
            camera.aspect = size[0]/size[1];
            camera.updateProjectionMatrix();
        }
        function start_resizing() {
            document.addEventListener("mousemove", resizing);
            document.addEventListener("mouseup", end_resizing);
        }
        function end_resizing() {
            document.removeEventListener("mousemove", resizing);
            document.removeEventListener("mouseup", end_resizing);
        }
        resize.addEventListener("mousedown", start_resizing);
        resize.addEventListener("dblclick", () => {
            renderer.setSize(default_size[0], default_size[1]);
            camera.aspect = default_size[0]/default_size[1];
            camera.updateProjectionMatrix();
        })

        let reset_view = document.createElement("button");
        reset_view.innerHTML = "⟳";
        reset_view.classList.add("reset-view-button");
        renderer.domElement.parentElement.appendChild(reset_view);

        reset_view.addEventListener("click", on_view_reset);
    }

    export() {
        let self = this;
        let as_nbt = document.getElementById("save_as_nbt");
        as_nbt.addEventListener("click", () => {
            let name = self.save_name;
            if (name === null) {
                name = "statue";
            }
            this.SG.access_prompt_save(name);
        })
    }

    output_materials() {
        function stack_count(count) {
            if (count <= 64) {
                return count;
            }
            let s = Math.floor(count/64) + "x64";
            let rest = count%64;
            if (rest === 0) {
                return s;
            }
            s += " + " + rest;
            return s;
        }
        let e = document.getElementById("output_materials");
        e.innerHTML = "";
        let table = document.createElement("table");
        e.appendChild(table);

        for (let mat of this.SG.access_block_count()) {
            let tr = document.createElement("tr");
            tr.dataset.uuid = mat["uuid"];
            table.appendChild(tr);
            
            let x_button = document.createElement("button");
            x_button.innerHTML = "✕";
            x_button.addEventListener("click", (event) => {
                let palette = document.getElementById("palette");
                let remove_uuid = event.target.parentNode.dataset.uuid;
                if (remove_uuid === "8b12ace7-dcd9-4db0-8cfa-0e8bcf036cc8") {
                    let add_string_checkbox = document.getElementById("add_string");
                    add_string_checkbox.checked = false;
                    add_string_checkbox.dispatchEvent(new Event("change"));
                    return;
                }
                for (let c of palette.childNodes) {
                    let checkbox = c.getElementsByTagName("summary")[0].getElementsByTagName("input")[0];
                    if (!checkbox.checked) {
                        continue;
                    }
                    for (let block of c.getElementsByTagName("div")) {
                        if (block.dataset.uuid === remove_uuid) {
                            let checkbox = block.getElementsByTagName("input")[0];
                            checkbox.checked = false;
                            checkbox.dispatchEvent(new Event("change"));
                            this._palette_changed();
                            return;
                        }
                    }
                }
            })
            tr.appendChild(x_button);

            let image_td = document.createElement("td");
            let image = document.createElement("img");
            image.draggable = false;
            if (mat["texture"] !== null) {
                image.src = mat["texture"]["side"];
            } else if (mat["name"] === "String") {
                image.src = string_texture;
            } else {
                image.src = null;
            }
            image_td.appendChild(image);
            tr.appendChild(image_td);

            let name = document.createElement("td");
            name.innerHTML = mat["name"];
            tr.appendChild(name);

            let count = document.createElement("td");
            count.innerHTML = mat["count"] + " (" + stack_count(mat["count"]) + ")";
            tr.appendChild(count);
        }
    }
}

window.PC = new PageControl();