
// const Preset = { ASSET_GENERATOR: 'assetgenerator' };

const DEFAULT_CAMERA = '[default]';

export default class Viewer 
{

    constructor(el) {
        
        this.el = el;
        
        this.content;
        this.lights = [];
        this.mixer = null;
        this.clips = [];
        this.gui = null;

        this.scene = new THREE.Scene();
        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });

        this.loader = new THREE.GLTFLoader();
        this.dracoLoader = new THREE.DRACOLoader();
        this.dracoLoader.setDecoderPath('https://www.gstatic.com/draco/v1/decoders/');
        this.loader.setDRACOLoader( this.dracoLoader );
        
        this.state = {
            bgColor: '#202020',
            bgActive: false,
            actionStates: {},
            camera: DEFAULT_CAMERA,

            // luzes
            punctualLights: true,
            exposure: 0.0,
            toneMapping: THREE.ACESFilmicToneMapping,
            ambientIntensity: 0.3,
            ambientColor: '#FFFFFF',
            directIntensity: 0.5 * Math.PI,
			directColor: '#FFFFFF',
        }

        // camera config
        const fov = 75;
        const aspect = el.clientWidth / el.clientHeight;
        this.defaultCamera  = new THREE.PerspectiveCamera(fov, aspect, 0.1, 1000);
        this.scene.add(this.defaultCamera );

        // Luz ambiente
        this.clock = new THREE.Clock();

        // OrbitControls
        this.controls = new THREE.OrbitControls(this.defaultCamera, this.renderer.domElement);
		this.controls.screenSpacePanning = true;
        
        // renderer tamanho
        this.renderer.setSize(el.clientWidth, el.clientHeight);
        this.el.appendChild(this.renderer.domElement);

        this.backgroundColor = new THREE.Color(this.state.bgColor);


        this.background(true);
        this.#run();
    }

    async #run() {
        await this.#load();
        this.animate = this.#animate.bind(this);
        requestAnimationFrame(this.animate);
    }

    background(active, color) {
        this.state.bgActive = active;
        this.bgColor = color;

        if(active || this.state.bgActive) {
            this.scene.background = this.backgroundColor;
        }

    }

    #render() {
        this.renderer.render(this.scene, this.defaultCamera);
    }

    #loadModel(url) {
        return new Promise((resolve, reject) => {
            this.loader.load(url, (gltf) => {

                const scene = gltf.scene || gltf.scenes[0];
				const clips = gltf.animations || [];

                if (!scene) {
                    // Valid, but not supported by this viewer.
                    throw new Error(
                        'This model contains no scene, and cannot be viewed here. However,' +
                            ' it may contain individual 3D resources.',
                    );
                }

                this.#setContent(scene, clips);

                resolve(gltf);
            }, undefined, (error) => {
                reject(error);
            });
        });
    }

    async #load() {
        this.model = await this.#loadModel("models/sapato/MaterialsVariantsShoe.gltf");
        // this.model = await this.#loadModel("models/camiseta/camiseta.gltf");

        this.model = this.model.scene;
    }

    #setContent(object, clips) {
        object.updateMatrixWorld(); // donmccurdy/three-gltf-viewer#330

		const box = new THREE.Box3().setFromObject(object);
		const size = box.getSize(new THREE.Vector3()).length();
		const center = box.getCenter(new THREE.Vector3());

		object.position.x -= center.x;
		object.position.y -= center.y;
		object.position.z -= center.z;

        this.defaultCamera.near = size / 100;
		this.defaultCamera.far = size * 100;
		this.defaultCamera.updateProjectionMatrix();

        this.defaultCamera.position.copy(center);
        this.defaultCamera.position.x += size / 2.0;
        this.defaultCamera.position.y += size / 5.0;
        this.defaultCamera.position.z += size / 2.0;
        this.defaultCamera.lookAt(center);

        this.setCamera(DEFAULT_CAMERA);
        this.scene.add(object);
        this.content = object;

        this.controls.saveState();

        this.state.punctualLights = true;

        this.content.traverse((node) => {
			if (node.isLight) {
				this.state.punctualLights = false;
			}
		});

        // Configurar o mixer de animação
        this.mixer = new THREE.AnimationMixer(object);

        // Reproduzir todas as animações
        clips.forEach((clip) => {
            this.mixer.clipAction(clip).play();
        });

        this.updateLights();

        // this.printGraph(this.content);
    }


    printGraph(node) {
		console.group(' <' + node.type + '> ' + node.name);
		node.children.forEach((child) => this.printGraph(child));
		console.groupEnd();
	}

    setCamera(name) {
		if (name === DEFAULT_CAMERA) {
			this.controls.enabled = true;
			this.activeCamera = this.defaultCamera;
		} else {
			this.controls.enabled = false;
			this.content.traverse((node) => {
				if (node.isCamera && node.name === name) {
					this.activeCamera = node;
				}
			});
		}
	}

    updateLights() {
        
        const state = this.state;
		const lights = this.lights;
        console.log(lights);

		if (state.punctualLights && !lights.length) {
			this.addLights();
		} else if (!state.punctualLights && lights.length) {
			this.removeLights();
		}

		this.renderer.toneMapping = Number(state.toneMapping);
		this.renderer.toneMappingExposure = Math.pow(2, state.exposure);

		if (lights.length === 2) {
			lights[0].intensity = state.ambientIntensity;
			lights[0].color.set(state.ambientColor);
			lights[1].intensity = state.directIntensity;
			lights[1].color.set(state.directColor);
		}
	}

    addLights() {
		const state = this.state;

		const light1 = new THREE.AmbientLight(state.ambientColor, state.ambientIntensity);
		light1.name = 'ambient_light';
		this.defaultCamera.add(light1);

		const light2 = new THREE.DirectionalLight(state.directColor, state.directIntensity);
		light2.position.set(0.5, 0, 0.866); // ~60º
		light2.name = 'main_light';
		this.defaultCamera.add(light2);
        
        this.lights.push(light1, light2);
	}

    removeLights() {
		this.lights.forEach((light) => light.parent.remove(light));
		this.lights.length = 0;
	}

    setClips(clips) {
        
        if (this.mixer) {
            this.mixer.stopAllAction();
			this.mixer.uncacheRoot(this.mixer.getRoot());
			this.mixer = null;
		}
        
		this.clips = clips;
		if (!clips.length) return;

		this.mixer = new THREE.AnimationMixer(this.content);

	}

    #animate(time) {
        requestAnimationFrame( this.animate );
        // toda animação e renderização.

        const delta = this.clock.getDelta(); // Para atualizar o mixer de animação
        if (this.mixer) this.mixer.update(delta);

        // this.model.rotation.y += 0.01;
        this.controls.update();
        this.#render();
    }

}
