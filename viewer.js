export default class Viewer 
{

    constructor(el) {
        this.el = el;
        this.content;

        console.log(el.clientHeight);

        this.scene = new THREE.Scene();
        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });

        this.loader = new THREE.GLTFLoader();
        this.dracoLoader = new THREE.DRACOLoader();
        this.dracoLoader.setDecoderPath('https://www.gstatic.com/draco/v1/decoders/');
        this.loader.setDRACOLoader( this.dracoLoader );
        
        this.state = {
            bgColor: '#202020',
            bgActive: true,
        }

        // camera config
        const fov = 12;
        const aspect = el.clientWidth / el.clientHeight;
        this.camera = new THREE.PerspectiveCamera(fov, aspect, 0.1, 1000);
        this.scene.add(this.camera);

        // Luz ambiente
        this.light = new THREE.AmbientLight(0xfffffff, 1);
        this.scene.add(this.light);
        
        // renderer tamanho
        this.renderer.setSize(el.clientWidth, el.clientHeight);
        this.el.appendChild(this.renderer.domElement);


        this.backgroundColor = new THREE.Color(this.state.bgColor);

        this.background(null);
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
        this.renderer.render(this.scene, this.camera);
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
        this.model = this.model.scene;
    }

    #setContent(object, clips) {
        object.updateMatrixWorld(); // donmccurdy/three-gltf-viewer#330

		const box = new THREE.Box3().setFromObject(object);
		const size = box.getSize(new THREE.Vector3()).length();
		const center = box.getCenter(new THREE.Vector3());

		object.position.x += center.x *25;
		object.position.y -= center.y;
		object.position.z -= center.z;

        this.camera.position.z = 2;
        this.camera.position.x = size / 6;
        this.camera.position.y = 0;
        
        this.scene.add(object);

        this.content = object;

    }


    #animate() {
        requestAnimationFrame( this.animate );

        this.model.rotation.y += 0.01;

        // toda animação e renderização.
        this.#render();
    }

}
