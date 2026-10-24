"use strict";

(function exposeGlbViewer(global) {
  const COMPONENTS = {
    5121: { size: 1, type: Uint8Array, gl: 0x1401 },
    5123: { size: 2, type: Uint16Array, gl: 0x1403 },
    5125: { size: 4, type: Uint32Array, gl: 0x1405 },
    5126: { size: 4, type: Float32Array, gl: 0x1406 }
  };
  const TYPE_SIZE = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };

  function parseGlb(arrayBuffer) {
    const view = new DataView(arrayBuffer);
    if (view.getUint32(0, true) !== 0x46546c67) throw new Error("Invalid GLB magic.");
    if (view.getUint32(4, true) !== 2) throw new Error("Only glTF 2.0 GLB assets are supported.");
    if (view.getUint32(8, true) !== arrayBuffer.byteLength) throw new Error("GLB declared length mismatch.");

    let offset = 12;
    let json = null;
    let bin = null;
    while (offset + 8 <= arrayBuffer.byteLength) {
      const length = view.getUint32(offset, true);
      const type = view.getUint32(offset + 4, true);
      const start = offset + 8;
      const end = start + length;
      if (end > arrayBuffer.byteLength) throw new Error("Malformed GLB chunk.");
      if (type === 0x4e4f534a) {
        json = JSON.parse(new TextDecoder().decode(new Uint8Array(arrayBuffer, start, length)).trim());
      } else if (type === 0x004e4942) {
        bin = arrayBuffer.slice(start, end);
      }
      offset = end;
    }
    if (!json || !bin) throw new Error("GLB must contain JSON and BIN chunks.");
    return { json, bin };
  }

  function accessorInfo(gltf, bin, accessorIndex) {
    const accessor = gltf.accessors[accessorIndex];
    const bufferView = gltf.bufferViews[accessor.bufferView];
    const component = COMPONENTS[accessor.componentType];
    const itemSize = TYPE_SIZE[accessor.type];
    if (!accessor || !bufferView || !component || !itemSize) throw new Error("Unsupported GLB accessor.");
    if (bufferView.byteStride && bufferView.byteStride !== component.size * itemSize) {
      throw new Error("Interleaved GLB accessors are not supported by this presentation viewer.");
    }
    const byteOffset = (bufferView.byteOffset || 0) + (accessor.byteOffset || 0);
    const values = new component.type(bin, byteOffset, accessor.count * itemSize);
    return { accessor, component, itemSize, values };
  }

  function shader(gl, type, source) {
    const handle = gl.createShader(type);
    gl.shaderSource(handle, source);
    gl.compileShader(handle);
    if (!gl.getShaderParameter(handle, gl.COMPILE_STATUS)) {
      throw new Error(gl.getShaderInfoLog(handle) || "Unable to compile 3D viewer shader.");
    }
    return handle;
  }

  function program(gl) {
    const vertex = shader(gl, gl.VERTEX_SHADER, `#version 300 es
      in vec3 aPosition;
      in vec4 aColor;
      uniform vec3 uCenter;
      uniform float uScale;
      uniform float uAspect;
      uniform float uYaw;
      uniform float uPitch;
      out vec4 vColor;
      out vec3 vSurface;
      void main() {
        vec3 p = (aPosition - uCenter) * uScale;
        float cy = cos(uYaw), sy = sin(uYaw);
        float cp = cos(uPitch), sp = sin(uPitch);
        p = vec3(cy*p.x + sy*p.z, p.y, -sy*p.x + cy*p.z);
        p = vec3(p.x, cp*p.y - sp*p.z, sp*p.y + cp*p.z);
        gl_Position = vec4(p.x / max(uAspect, 0.01), p.y, p.z * 0.35, 1.0);
        vColor = aColor;
        vSurface = p;
      }`);
    const fragment = shader(gl, gl.FRAGMENT_SHADER, `#version 300 es
      precision mediump float;
      in vec4 vColor;
      in vec3 vSurface;
      uniform bool uDetailedLighting;
      out vec4 outColor;
      void main() {
        vec3 lit = vColor.rgb * 0.82 + vec3(0.12);
        if (uDetailedLighting) {
          vec3 normal = normalize(cross(dFdx(vSurface), dFdy(vSurface)));
          normal = gl_FrontFacing ? normal : -normal;
          vec3 keyLight = normalize(vec3(-0.42, 0.73, 0.55));
          float diffuse = max(dot(normal, keyLight), 0.0);
          float fill = max(dot(normal, normalize(vec3(0.65, 0.22, -0.6))), 0.0);
          float specular = pow(max(dot(reflect(-keyLight, normal), vec3(0.0, 0.0, 1.0)), 0.0), 20.0);
          lit = vColor.rgb * (0.48 + 0.42 * diffuse + 0.15 * fill) + vec3(0.09) * specular;
        }
        outColor = vec4(clamp(lit, 0.0, 1.0), vColor.a);
      }`);
    const handle = gl.createProgram();
    gl.attachShader(handle, vertex);
    gl.attachShader(handle, fragment);
    gl.linkProgram(handle);
    if (!gl.getProgramParameter(handle, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(handle) || "Unable to link 3D viewer shader.");
    }
    return handle;
  }

  class GlbViewer {
    constructor(canvas, statusElement) {
      this.canvas = canvas;
      this.statusElement = statusElement || null;
      this.gl = canvas.getContext("webgl2", { antialias: true, alpha: false });
      this.drawables = [];
      this.center = [0, 0, 0];
      this.radius = 1;
      this.yaw = -0.55;
      this.pitch = 0.28;
      this.zoom = 0.78;
      this.detailedLighting = false;
      this.drag = null;
      if (!this.gl) {
        this.setStatus("3D preview unavailable in this browser. Equipment capability remains unchanged.", "unavailable");
        return;
      }
      this.program = program(this.gl);
      this.locations = {
        position: this.gl.getAttribLocation(this.program, "aPosition"),
        color: this.gl.getAttribLocation(this.program, "aColor"),
        center: this.gl.getUniformLocation(this.program, "uCenter"),
        scale: this.gl.getUniformLocation(this.program, "uScale"),
        aspect: this.gl.getUniformLocation(this.program, "uAspect"),
        yaw: this.gl.getUniformLocation(this.program, "uYaw"),
        pitch: this.gl.getUniformLocation(this.program, "uPitch"),
        detailedLighting: this.gl.getUniformLocation(this.program, "uDetailedLighting")
      };
      this.bindInteraction();
      this.resizeObserver = new ResizeObserver(() => this.render());
      this.resizeObserver.observe(canvas);
    }

    setStatus(message, state = "ready") {
      if (!this.statusElement) return;
      this.statusElement.textContent = message;
      this.statusElement.dataset.state = state;
    }

    bindInteraction() {
      this.canvas.addEventListener("pointerdown", (event) => {
        this.drag = { x: event.clientX, y: event.clientY, yaw: this.yaw, pitch: this.pitch };
        this.canvas.setPointerCapture(event.pointerId);
      });
      this.canvas.addEventListener("pointermove", (event) => {
        if (!this.drag) return;
        this.yaw = this.drag.yaw + (event.clientX - this.drag.x) * 0.012;
        this.pitch = Math.max(-1.2, Math.min(1.2, this.drag.pitch + (event.clientY - this.drag.y) * 0.012));
        this.render();
      });
      const stop = () => { this.drag = null; };
      this.canvas.addEventListener("pointerup", stop);
      this.canvas.addEventListener("pointercancel", stop);
      this.canvas.addEventListener("wheel", (event) => {
        event.preventDefault();
        this.zoom = Math.max(0.38, Math.min(1.4, this.zoom * (event.deltaY > 0 ? 0.9 : 1.1)));
        this.render();
      }, { passive: false });
      this.canvas.addEventListener("keydown", (event) => {
        const step = 0.12;
        if (event.key === "ArrowLeft") this.yaw -= step;
        else if (event.key === "ArrowRight") this.yaw += step;
        else if (event.key === "ArrowUp") this.pitch = Math.max(-1.2, this.pitch - step);
        else if (event.key === "ArrowDown") this.pitch = Math.min(1.2, this.pitch + step);
        else if (event.key === "+" || event.key === "=") this.zoom = Math.min(1.4, this.zoom * 1.1);
        else if (event.key === "-") this.zoom = Math.max(0.38, this.zoom * 0.9);
        else return;
        event.preventDefault();
        this.render();
      });
    }

    clearModel() {
      if (!this.gl) return;
      for (const item of this.drawables) {
        this.gl.deleteBuffer(item.positionBuffer);
        this.gl.deleteBuffer(item.colorBuffer);
        this.gl.deleteBuffer(item.indexBuffer);
      }
      this.drawables = [];
    }

    async load(url, title) {
      if (!this.gl) return false;
      this.setStatus(`Loading ${title}…`, "loading");
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Unable to load 3D asset: HTTP ${response.status}`);
      const { json, bin } = parseGlb(await response.arrayBuffer());
      this.clearModel();

      const mins = [Infinity, Infinity, Infinity];
      const maxs = [-Infinity, -Infinity, -Infinity];

      for (const mesh of json.meshes || []) {
        for (const primitive of mesh.primitives || []) {
          if (primitive.mode !== undefined && primitive.mode !== 4) continue;
          if (primitive.attributes?.POSITION === undefined || primitive.indices === undefined) continue;

          const position = accessorInfo(json, bin, primitive.attributes.POSITION);
          const color = primitive.attributes.COLOR_0 !== undefined
            ? accessorInfo(json, bin, primitive.attributes.COLOR_0)
            : null;
          const index = accessorInfo(json, bin, primitive.indices);

          for (let axis = 0; axis < 3; axis += 1) {
            mins[axis] = Math.min(mins[axis], position.accessor.min?.[axis] ?? 0);
            maxs[axis] = Math.max(maxs[axis], position.accessor.max?.[axis] ?? 0);
          }

          const gl = this.gl;
          const positionBuffer = gl.createBuffer();
          gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
          gl.bufferData(gl.ARRAY_BUFFER, position.values, gl.STATIC_DRAW);

          const colorBuffer = gl.createBuffer();
          gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
          if (color) gl.bufferData(gl.ARRAY_BUFFER, color.values, gl.STATIC_DRAW);
          else gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(position.accessor.count * 4).fill(0.72), gl.STATIC_DRAW);

          const indexBuffer = gl.createBuffer();
          gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
          gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, index.values, gl.STATIC_DRAW);

          this.drawables.push({
            positionBuffer,
            colorBuffer,
            indexBuffer,
            count: index.accessor.count,
            indexType: index.component.gl,
            colorType: color?.component.gl || gl.FLOAT,
            colorSize: color?.itemSize || 4,
            colorNormalized: Boolean(color?.accessor.normalized)
          });
        }
      }

      if (!this.drawables.length) throw new Error("No supported triangle primitives found in GLB.");
      this.center = mins.map((min, axis) => (min + maxs[axis]) / 2);
      const extent = Math.max(...maxs.map((max, axis) => max - mins[axis]), 0.001);
      this.radius = extent / 2;
      this.yaw = -0.55;
      this.pitch = 0.28;
      this.zoom = 0.78;
      this.canvas.setAttribute("aria-label", `Interactive 3D model: ${title}. Drag to rotate; use mouse wheel, plus, or minus to zoom.`);
      this.setStatus(`${title} loaded from reusable GLB asset.`, "ready");
      this.render();
      return true;
    }

    render() {
      const gl = this.gl;
      if (!gl || !this.program || !this.drawables.length) return;
      const rect = this.canvas.getBoundingClientRect();
      const dpr = Math.min(global.devicePixelRatio || 1, 2);
      const width = Math.max(1, Math.round(rect.width * dpr));
      const height = Math.max(1, Math.round(rect.height * dpr));
      if (this.canvas.width !== width || this.canvas.height !== height) {
        this.canvas.width = width;
        this.canvas.height = height;
      }
      gl.viewport(0, 0, width, height);
      gl.enable(gl.DEPTH_TEST);
      gl.enable(gl.CULL_FACE);
      gl.clearColor(0.965, 0.973, 0.985, 1);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.useProgram(this.program);
      gl.uniform3fv(this.locations.center, this.center);
      gl.uniform1f(this.locations.scale, this.zoom / this.radius);
      gl.uniform1f(this.locations.aspect, width / height);
      gl.uniform1f(this.locations.yaw, this.yaw);
      gl.uniform1f(this.locations.pitch, this.pitch);
      gl.uniform1i(this.locations.detailedLighting, this.detailedLighting ? 1 : 0);

      for (const item of this.drawables) {
        gl.bindBuffer(gl.ARRAY_BUFFER, item.positionBuffer);
        gl.enableVertexAttribArray(this.locations.position);
        gl.vertexAttribPointer(this.locations.position, 3, gl.FLOAT, false, 0, 0);

        gl.bindBuffer(gl.ARRAY_BUFFER, item.colorBuffer);
        gl.enableVertexAttribArray(this.locations.color);
        gl.vertexAttribPointer(this.locations.color, item.colorSize, item.colorType, item.colorNormalized, 0, 0);

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, item.indexBuffer);
        gl.drawElements(gl.TRIANGLES, item.count, item.indexType, 0);
      }
    }

    destroy() {
      this.clearModel();
      this.resizeObserver?.disconnect();
    }
  }

  global.AutoLearnProGlbViewer = Object.freeze({ GlbViewer, parseGlb });
})(window);
