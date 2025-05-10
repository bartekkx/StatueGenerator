class NBT {
    static Type_ID = {
        "End": 0,
        "Byte": 1,
        "Short": 2,
        "Int": 3,
        "Long": 4,
        "Float": 5,
        "Double": 6,
        "Byte_Array": 7,
        "String": 8,
        "List": 9,
        "Compound": 10,
        "Int_Array": 11,
        "Long_Array": 12
    }

    static Byte(value) {
        let r = new DataView(new ArrayBuffer(1));
        r.setInt8(0, value);
        r = new Uint8Array(r.buffer);
        return Array.from(r);
    }

    static Short(value) {
        let r = new DataView(new ArrayBuffer(2));
        r.setInt16(0, value);
        r = new Uint8Array(r.buffer);
        return Array.from(r);
    }

    static Int(value) {
        let r = new DataView(new ArrayBuffer(4));
        r.setInt32(0, value);
        r = new Uint8Array(r.buffer);
        return Array.from(r);
    }

    static Long(value) {
        let r = new DataView(new ArrayBuffer(8));
        r.setBigInt64(0, BigInt(value));
        r = new Uint8Array(r.buffer);
        return Array.from(r);
    }

    static Float(value) {
        let r = new DataView(new ArrayBuffer(4));
        r.setFloat32(0, value);
        r = new Uint8Array(r.buffer);
        return Array.from(r);
    }

    static Double(value) {
        let r = new DataView(new ArrayBuffer(8));
        r.setFloat64(0, value);
        r = new Uint8Array(r.buffer);
        return Array.from(r);
    }

    static String(value) {
        let r = new DataView(new ArrayBuffer(2));
        r.setInt16(0, (new TextEncoder()).encode(value).length);
        r = new Uint8Array(r.buffer);
        let o =  Array.from(r);

        let utf8 = new TextEncoder().encode(value);
        utf8 = Array.from(utf8)
        o = o.concat(utf8)

        return o;
    }

    static List(type, values) {
        if (type === "Compound") {
            let new_values = [];
            for (let value of values) {
                new_values.push(value.slice(1));
            }
            values = new_values;
        }

        let o = [NBT.Type_ID[type]];

        let len = values.length
        o = o.concat(NBT.Int(len));
        
        for (let value of values) {
            o = o.concat(value);
        }

        return o;
    }

    static Compound(value, root_name=null) {
        let o = [NBT.Type_ID["Compound"]];

        if (!(root_name === null)) {
            o = o.concat(NBT.String(root_name));
        }

        for (let [name, v] of Object.entries(value)) {
            let [type, value] = v;

            o.push(this.Type_ID[type]);
            o = o.concat(NBT.String(name));
            if (type === "Compound") {
                o = o.concat(value.slice(1));
            } else {
                o = o.concat(value);
            }
        }

        o.push([NBT.Type_ID["End"]]);

        return o;
    }

    static object_to_compound(object) {
        let o = {};

        for (let [key, value] of Object.entries(object)) {
            if (typeof value === "string") {
                o[key] = ["String", NBT.String(value)];
            } else if (typeof value === "object") {
                o[key] = ["Compound", NBT.object_to_compound(value)];
            }
        }

        return NBT.Compound(o);
    }

}


class Model {
    constructor() {
        this.selection = null;
        this.order = null;
        this.elements = null;
        this.image = null;
        this.adjust = null;
    }

    apply_elements(elements) {
        this.elements = {};
        this.adjust = [0, 0, 0];

        for (let x of elements) {
            let uuid = x["uuid"];
            for (let [face, value] of Object.entries(x["faces"])) {
                this.elements[uuid + "," + face] = {"face": face, "from": x["from"], "to": x["to"], "uv": value["uv"]};
                this.adjust = [Math.min(this.adjust[0], x["from"][0]), Math.min(this.adjust[1], x["from"][1]), Math.min(this.adjust[2], x["from"][2])]
            }
        }
    }

    apply_selection(allowed_uuids) {
        this.selection = allowed_uuids;
    }

    apply_order(uuid_list) {
        this.order = uuid_list;
    }

    apply_image(image) {
        this.image = image;
    }

    *iter_face(face) {
        let face_value = this.elements[face];
        let texture_start = [Math.min(face_value["uv"][0], face_value["uv"][2]), Math.min(face_value["uv"][1], face_value["uv"][3])]
        let texture_end = [Math.max(face_value["uv"][0], face_value["uv"][2]), Math.max(face_value["uv"][1], face_value["uv"][3])]

        for (let texture_y = 0; texture_y < texture_end[1]-texture_start[1]; texture_y++) {
            for (let texture_x = 0; texture_x < texture_end[0]-texture_start[0]; texture_x++) {
                let byte_offset = (this.image.width*(texture_y+texture_start[1]) + (texture_x+texture_start[0]))*4
                if (byte_offset >= this.image.data.length) {
                    continue;
                }
                let current = {"r": this.image.data[byte_offset+0], 
                               "g": this.image.data[byte_offset+1], 
                               "b": this.image.data[byte_offset+2], 
                               "a": this.image.data[byte_offset+3],
                               "face": face_value["face"]};
                
                
                switch(face_value["face"]) {
                    case "north":
                        current["z"] = face_value["from"][2]-this.adjust[2]+1;
                        current["y"] = face_value["to"][1]-this.adjust[1]-texture_y;
                        current["x"] = face_value["to"][0]-this.adjust[0]-texture_x;
                        break;
                    case "south":
                        current["z"] = face_value["to"][2]-this.adjust[2];
                        current["y"] = face_value["to"][1]-this.adjust[1]-texture_y;
                        current["x"] = face_value["from"][0]-this.adjust[0]+texture_x+1;
                        break;
                    case "east":
                        current["x"] = face_value["to"][0]-this.adjust[0];
                        current["y"] = face_value["to"][1]-this.adjust[1]-texture_y;
                        current["z"] = face_value["to"][2]-this.adjust[2]-texture_x;
                        break;
                    case "west":
                        current["x"] = face_value["from"][0]-this.adjust[0]+1;
                        current["y"] = face_value["to"][1]-this.adjust[1]-texture_y;
                        current["z"] = face_value["from"][2]-this.adjust[2]+texture_x+1;
                        break;
                    case "up":
                        current["y"] = face_value["to"][1]-this.adjust[1];
                        current["z"] = face_value["to"][2]-this.adjust[2]-texture_y;
                        current["x"] = face_value["to"][0]-this.adjust[0]-texture_x;
                        break;
                    case "down":
                        current["y"] = face_value["from"][1]-this.adjust[1]+1;
                        current["z"] = face_value["to"][2]-this.adjust[2]-texture_y;
                        current["x"] = face_value["to"][0]-this.adjust[0]-texture_x;
                        break;
                    
                }


                yield current;
            }
        }
    }

    *iter() {
        if (this.elements === null) {
            throw new Error("Model has to contain elements");
        }
        if (this.image === null) {
            throw new Error("Model has to have a texture image");
        }

        let order = this.order;
        if (order === null) {
            order = Object.keys(this.elements);
        }

        for (let face of order) {
            if (this.selection !== null) {
                if (!this.selection.includes(face)) {
                    continue;
                }
            }

            for (let pixel of this.iter_face(face)) {
                yield pixel;
            }
        }
    }

}


class Voxels {
    static merge_methods = {
        first_non_transparent(values) {
            for (let x of values) {
                if (x["a"] === undefined) {
                    continue;
                }
                if (x["a"] != 255) {
                    continue;
                }
                return x;
            }
        }
    }

    constructor() {
        this.voxel_array = {};
        this.merged_voxel_array = null;
    }

    add_pixel_face(face) {
        let position = [face["x"], face["y"], face["z"]];
        if (!(position in this.voxel_array)) {
            this.voxel_array[position] = [];
        }
        this.voxel_array[position].push(face);
    }

    merge(merge_method) {
        this.merged_voxel_array = {};
        for (let [key, value] of Object.entries(this.voxel_array)) {
            let current = merge_method(value);
            if (current === undefined) {
                continue;
            }
            this.merged_voxel_array[key] = current;
        }

    }

    *iter() {
        if (this.merged_voxel_array === null) {
            throw new Error("voxel_array wasn't merged.");
        }

        for (let [key, value] of Object.entries(this.merged_voxel_array)) {
            yield value;
        }

    }

}


class Blocks {
    static color_difference_methods = {
        "sRGB distance": function (a, b) {
            return (a.coords[0]-b.coords[0])**2 + (a.coords[1]-b.coords[1])**2 + (a.coords[2]-b.coords[2])**2
        },
        "OkLab Distance": function (a, b) {
            return (a.coords[0]-b.coords[0])**2 + (a.coords[1]-b.coords[1])**2 + (a.coords[2]-b.coords[2])**2;
        },
        "deltaE CIE76": function (a, b) {
            return a.deltaE76(b);
        },
        "deltaE CMC": function (a, b) {
            return a.deltaECMC(b);
        },
        "deltaE ITP": function (a, b) {
            return a.deltaEITP(b);
        },
        "deltaE CIE2000": function (a, b) {
            return a.deltaE2000(b);
        }
    }

    static prefered_color_space = {
        "sRGB distance": "sRGB",
        "OkLab Distance": "OKLab",
        "OkLab Distance0": "OKLab",
        "deltaE CIE76": "Lab",
        "deltaE CMC": "Lab",
        "deltaE ITP": "ICtCp",
        "deltaE CIE2000": "Lab"
    }

    static determine_closest(color, palette, color_difference) {
        let current_distnace = null;
        let current_color = null;

        for (let c of palette) {
            let distance = color_difference(color["color"], c["color"]);
            if (current_distnace === null) {
                current_distnace = distance;
                current_color = c;
                continue;
            }
            if (distance < current_distnace) {
                current_distnace = distance;
                current_color = c;
            }

        }

        return current_color;

    }

    constructor() {
        this.block_array = [];
        this.processed_block_array = null;
        this.min_bound = [Math.min(), Math.min(), Math.min()];
    }

    add_block(block) {
        this.block_array.push(block);
        this.min_bound = [Math.min(this.min_bound[0], block["x"]), Math.min(this.min_bound[1], block["y"]), Math.min(this.min_bound[2], block["z"])];
    }

    process(palette, color_difference) {
        this.processed_block_array = {};
        if (palette.length === 0) {
            return;
        }
        let block_array_copy = structuredClone(this.block_array);
        let palette_copy = structuredClone(palette);

        for (let value of Object.values(palette_copy)) {
            value["color"] = new Color("sRGB", [value["r"], value["g"], value["b"]]).to(Blocks.prefered_color_space[color_difference.name]);
        }
        for (let value of Object.values(block_array_copy)) {
            value["color"] = new Color("sRGB", [value["r"], value["g"], value["b"]]).to(Blocks.prefered_color_space[color_difference.name]);
        }

        let cache = {};

        for (let block of block_array_copy) {
            let position = [block["x"], block["y"], block["z"]];
            let value = [block["r"], block["g"], block["b"]];

            if (value in cache) {
                this.processed_block_array[position] = cache[value];
                continue;
            }
            let current = Blocks.determine_closest(block, palette_copy, color_difference);
            cache[value] = current;
            this.processed_block_array[position] = current;
        }
    }

    reduce_blocks() {
        const flood_fill_neighbors = [[1, 0, 0], [0, 1, 0], [0, 0, 1], [-1, 0, 0], [0, -1, 0], [0, 0, -1]];
        let visible_neighbors = [];
        for (let x = -1; x <= 1; x++) {
            for (let y = -1; y <= 1; y++) {
                for (let z = -1; z <= 1; z++) {
                    if (!(x == 0 && y == 0 && z == 0)) {
                        visible_neighbors.push([x, y, z]);
                    }
                }
            }
        }

        let min = [Math.min(), Math.min(), Math.min()];
        let max = [Math.max(), Math.max(), Math.max()];
        let blocks = [];
        for (let b of Object.keys(this.processed_block_array)) {
            let values = b.split(",");
            blocks.push(values);
            min = [Math.min(min[0], values[0]), Math.min(min[1], values[1]), Math.min(min[2], values[2])];
            max = [Math.max(max[0], values[0]), Math.max(max[1], values[1]), Math.max(max[2], values[2])];
        }
        if (blocks.length === 0) {
            return;
        }
        min = min.map((v) => {return v-1});
        max = max.map((v) => {return v+1});
        let size = [(max[0]-min[0])+1, (max[1]-min[1])+1, (max[2]-min[2])+1];

        let ar = new Uint8Array(size[0]*size[1]*size[2]);
        function get_pos(pos) {
            if (pos[0] < min[0] || pos[1] < min[1] || pos[2] < min[2] || pos[0] > max[0] || pos[1] > max[1] || pos[2] > max[2]) {
                return null;
            }
            pos = [pos[0]-min[0], pos[1]-min[1], pos[2]-min[2]];
            pos = pos[0] + (pos[1]*size[0]) + (pos[2]*size[0]*size[1]);
            return pos;
        }

        for (let x of blocks) {
            ar[get_pos(x)] = 1;
        }

        let queue = [min];
        for (let pos of queue) {
            let real_pos = get_pos(pos);
            if (real_pos === null || ar[real_pos] !== 0) {
                continue;
            }
            ar[real_pos] = 2;
            for (let next_pos of flood_fill_neighbors) {
                next_pos = [pos[0]+next_pos[0], pos[1]+next_pos[1], pos[2]+next_pos[2]];
                queue.push(next_pos);
            }
        }

        for (let key of Object.keys(this.processed_block_array)) {
            let pos = key.split(",").map((v) => {return Number(v)});
            
            let should_remove = true;
            for (let n of visible_neighbors) {
                let c = [pos[0]+n[0], pos[1]+n[1], pos[2]+n[2]];
                let v = ar[get_pos(c)]
                if (v === null || v === 2) {
                    should_remove = false;
                    break;
                }
            }
            if (should_remove) {
                delete this.processed_block_array[key];
            }
        }
    }

    add_string() {
        const string_block = {
            "r": null,
            "g": null,
            "b": null,
            "texture_filename": null,
            "texture": null,
            "name": "String",
            "nbt": {"Name": "minecraft:tripwire"},
            "uuid": "8b12ace7-dcd9-4db0-8cfa-0e8bcf036cc8",
            "gravity": false
        }
        
        let lowest_y = Math.min();
        let gravity_blocks = [];
        for (let [index, value] of Object.entries(this.processed_block_array)) {
            index = index.split(",").map((v) => Number(v));
            lowest_y = Math.min(lowest_y, index[1]);
            if (value["gravity"]) {
                gravity_blocks.push(index);
            }
        }

        for (let block of gravity_blocks) {
            if (block[1] <= lowest_y) {
                continue;
            }
            block = [block[0], block[1]-1, block[2]].join(",");
            if (block in this.processed_block_array) {
                continue;
            }
            this.processed_block_array[block] = string_block;
        }

    }

    toNBT(data_version) {
        let palette = [];
        let nbt_palette_list = [];
        let nbt_block_list = [];
        let size = [0, 0, 0];

        for (let position in this.processed_block_array) {
            let block = this.processed_block_array[position];
            let index = palette.indexOf(block);
            if (index === -1) {
                palette.push(block);
                index = palette.length-1;
            }

            position = position.split(",");
            position = [position[0]-this.min_bound[0], position[1]-this.min_bound[1], position[2]-this.min_bound[2]];
            size = [Math.max(size[0], position[0]), Math.max(size[1], position[1]), Math.max(size[2], position[2])];
            
            nbt_block_list.push(NBT.Compound({
                "state": ["Int", NBT.Int(index)],
                "pos": ["List", NBT.List("Int", [NBT.Int(position[0]), NBT.Int(position[1]), NBT.Int(position[2])])]
            }))
        }

        for (let index in palette) {
            nbt_palette_list.push(NBT.object_to_compound(palette[index]["nbt"]));
        }

        let root_compound = NBT.Compound({
            "DataVersion": ["Int", NBT.Int(data_version)],
            "author": ["String", NBT.String("Statue Generator")],
            "blocks": ["List", NBT.List("Compound", nbt_block_list)],
            "palette": ["List", NBT.List("Compound", nbt_palette_list)],
            "size": ["List", NBT.List("Int", [NBT.Int(size[0]+1), NBT.Int(size[1]+1), NBT.Int(size[2]+1)])],
        }, "")

        return root_compound;
    }
}


// main interface
class StatueGenerator {
    constructor() {
        this.model = null;
        this.image = null;
        this.order = null;
        this.elements = null;
        this.palette = null;
        this.version = null;
        this.distance_function = null;
        this.merge_method = Voxels.merge_methods.first_non_transparent;
        this.reduce_blocks = false;
        this.add_string = false;
        this.refresh_scope = 0;

        this.cModel = new Model();
        this.cVoxels = new Voxels();
        this.cBlocks = new Blocks();
    }

    refresh() {
        let check_those = {"this.model": this.model,
                            "this.image": this.image,
                            "this.order": this.order,
                            "this.elements": this.elements,
                            "this.palette": this.palette,
                            "this.version": this.version,
                            "this.distance_function": this.distance_function}
        for (let [key, value] of Object.entries(check_those)) {
            if (value === null) {
                throw new Error("StatueGenerator error: " + key + " wasn't set");
            }
        }

        if (this.refresh_scope >= 3) {
            this.cModel = new Model();
            this.cModel.apply_elements(this.model.elements);
            this.cModel.apply_selection(this.elements);
            this.cModel.apply_order(this.order);
            this.cModel.apply_image(this.image);
        }

        if (this.refresh_scope >= 2) {
            this.cVoxels = new Voxels();
            for (let x of this.cModel.iter()) {
                this.cVoxels.add_pixel_face(x);
            }
            this.cVoxels.merge(this.merge_method)
        }
        
        if (this.refresh_scope >= 1) {
            this.cBlocks = new Blocks();
            for (let x of this.cVoxels.iter()) {
                this.cBlocks.add_block(x);
            }
            this.cBlocks.process(this.palette, this.distance_function)
            if (this.reduce_blocks) {
                this.cBlocks.reduce_blocks();
            }
            if (this.add_string) {
                this.cBlocks.add_string();
            }
        }

        this.refresh_scope = 0;
    }



    // methods prefixed with "access" are used to access generated data or options that were set

    async access_prompt_save(name="statue") {
        this.refresh();

        let a = new Blob([new Uint8Array(this.cBlocks.toNBT(supported_versions[this.version]))]);
        let compression = new CompressionStream("gzip");
        let compressed = a.stream().pipeThrough(compression);
        a = await new Response(compressed).blob();

        let e = document.createElement("a");
        e.href = URL.createObjectURL(a);
        e.download = name + ".nbt";
        e.click();
    }

    access_blocks() {
        this.refresh();
        return this.cBlocks.processed_block_array;
    }

    access_block_count() {
        let blocks = {};

        for (let x of Object.values(this.access_blocks())) {
            if (x["uuid"] in blocks) {
                blocks[x["uuid"]]["count"] += 1;
                continue;
            }
            blocks[x["uuid"]] = Object.assign({}, x);
            blocks[x["uuid"]]["count"] = 1;
        }
        blocks = Object.values(blocks);
        blocks.sort((a, b) => {return b["count"]-a["count"]});
        
        return blocks;
    }

    access_image_url(with_dimensions=false) {
        if (this.image === null) {
            if (with_dimensions) {
                return [null, null, null];
            } else {
                return null;
            }
        }

        let canvas = document.createElement("canvas");
        canvas.width = this.image.width;
        canvas.height = this.image.height;
        let ctx = canvas.getContext("2d");
        ctx.putImageData(this.image, 0, 0);

        if (with_dimensions) {
            return [canvas.toDataURL(), this.image.width, this.image.height];
        } else {
            return canvas.toDataURL();
        }
    }

    access_model_name() {
        return this.model["name"];
    }



    // methods prefixed with "get" are used to get option values for setting different options

    get_model() {
        return [Object.keys(models), "Normal"];
    }

    get_version() {
        return [Object.keys(supported_versions), "1.12.2"];
    }

    get_distance_function() {
        return [Object.keys(Blocks.color_difference_methods), "deltaE CIE76"];
    }

    get_palette() {
        if (this.version === null) {
            throw new Error("version must be specified before accessing palette of that version");
        }

        let data_version = supported_versions[this.version];
        let out = {};
        for (let entry of Object.values(palettes)) {
            if (!(entry["versions"][0] === null || entry["versions"][0] <= data_version)) {
                continue;
            }
            if (!(entry["versions"][1] === null || entry["versions"][1] >= data_version)) {
                continue;
            }
            if (!(entry["category"] in out)) {
                out[entry["category"]] = [];
            }
            let texture;
            if (entry["texture"]["side"] !== undefined) {
                texture = entry["texture"]["side"];
            } else if (entry["texture"]["top"] !== undefined) {
                texture = entry["texture"]["top"];
            } else if (entry["texture"]["bottom"] !== undefined) {
                texture = entry["texture"]["bottom"];
            }
            out[entry["category"]].push({"name": entry["name"], "texture": texture, "uuid": entry["uuid"]});
        }

        return Object.entries(out);
    }

    get_model_elements(model=null) {
        function element_from_uuid(uuid, self) {
            let correct_element;
            for (let x of self.model["elements"]) {
                if (x["uuid"] === uuid) {
                    correct_element = x;
                    break;
                }
            }
    
            let e = [];
            for (let face in correct_element["faces"]) {
                e.push([face, uuid+","+face]);
            }
    
            return [correct_element["name"], e];
        }

        let self = this;

        let next = "children";
        if (model === null) {
            model = this.model;
            next = "outliner";
        }
        if (model === null) {
            throw new Error("model has to be specified before getting its elements");
        }

        let o = [];
        for (let x of model[next]) {
            if (typeof x === "string") {
                o.push(element_from_uuid(x, self));
            } else {
                o.push([x["name"], self.get_model_elements(x)]);
            }
        }
        return o;
    }



    // methods prefixed with "set" are used to set different options

    set_distance_function(name) {
        if (!Object.keys(Blocks.color_difference_methods).includes(name)) {
            throw new Error("distance function name wasn't found");
        }
        this.distance_function = Blocks.color_difference_methods[name];
        this.refresh_scope = Math.max(this.refresh_scope, 1);
    }

    set_version(name) {
        if (!(name in supported_versions)) {
            throw new Error("version name wasn't found");
        }
        this.version = name;
    }

    set_model(name) {
        if (!Object.keys(models).includes(name)) {
            throw new Error("model name wasn't found");
        }
        this.model = models[name];
        this.refresh_scope = Math.max(this.refresh_scope, 3);
    }

    set_model_elements(uuids) {
        this.elements = uuids;
        this.refresh_scope = Math.max(this.refresh_scope, 3);
    }

    set_model_order(uuids) {
        this.order = uuids;
        this.refresh_scope = Math.max(this.refresh_scope, 3);
    }

    set_palette(block_uuids) {
        if (this.version === null) {
            throw new Error("version must be specified before setting palette");
        }

        let p = [];
        for (let uuid of block_uuids) {
            p.push(palettes[uuid]);
        }

        this.palette = p;
        this.refresh_scope = Math.max(this.refresh_scope, 1);
    }

    set_image(image_data) {
        this.image = image_data;
        this.refresh_scope = Math.max(this.refresh_scope, 3);
    }

    set_merge_method(method) {
        this.merge_method = method;
        this.refresh_scope = Math.max(this.refresh_scope, 2);
    }

    set_reduce_blocks(value) {
        this.reduce_blocks = value;
        this.refresh_scope = Math.max(this.refresh_scope, 1);
    }

    set_add_string(value) {
        this.add_string = value;
        this.refresh_scope = Math.max(this.refresh_scope, 1);
    }
}
