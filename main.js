const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 0, 300);
camera.lookAt(0, 0, 0);

const plane = new THREE.Mesh(
    new THREE.PlaneBufferGeometry(5000, 5000), 
    new THREE.MeshBasicMaterial({visible: false}));
scene.add(plane);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(new THREE.Color(0xffffff));
document.body.appendChild(renderer.domElement);

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

const groups = [];

// build physics model
const resolution = 15;
const system = new PointMassSystem({
    width: Math.floor(window.innerWidth / resolution) + 1,
    height: Math.floor((2 * window.innerHeight / 3) / resolution) + 1,
});
system.constantForce.y = 98;

const wiggleXScale = 0.01;
const wiggleYScale = 0.01;
for (let i = 0, ilen = system.getWidth(); i < ilen; i++) {
    for (let j = 0, jlen = system.getHeight(); j < jlen; j++) {
        const mass = system.getPointMassAt(i, j);
        mass.cx += (Math.random() > 0.5 ? 1 : -1) * Math.random() * wiggleXScale;
        mass.cy += (Math.random() > 0.5 ? 1 : -1) * Math.random() * wiggleYScale;
    }
}

for (let i = 0, len = system.getWidth(); i < len; i++) {
    system.getPointMassAt(i, 0).invMass = 0;
}

// build renderer
const scale = 2.4;
const numIndices = 6 * ((system.getWidth() - 1) * system.getHeight()) + 6 * ((system.getHeight() - 1) * system.getWidth());
const verts = new Float32Array(numIndices);
const gridGeo = new THREE.BufferGeometry();
gridGeo.setAttribute('position', new THREE.BufferAttribute(verts, 3));
const line = new THREE.Line(gridGeo, new THREE.LineBasicMaterial({ color: 0x111111 }));
line.frustumCulled = false;

const offset = new THREE.Vector2(
    -scale * system.getWidth() / 2,
    scale * system.getHeight() / 2);
line.position.set(offset.x, offset.y, 0);

const updateGrid = () => {
    let index = 0;
    for (let i = 0, ilen = system.getWidth(); i < ilen; i += 2) {
        for (let j = 0, jlen = system.getHeight(); j < jlen; j++) {
            const mass = system.getPointMassAt(i, j);
            
            // (i, j) -> (i + 1, j)
            if (null !== mass.right) {
                verts[index++] = mass.cx * scale;
                verts[index++] = -mass.cy * scale;
                verts[index++] = 0;
    
                verts[index++] = mass.right.cx * scale;
                verts[index++] = -mass.right.cy * scale;
                verts[index++] = 0;
            }
    
            // (i, j) -> (i, j + 1)
            if (null !== mass.bottom) {
                verts[index++] = mass.cx * scale;
                verts[index++] = -mass.cy * scale;
                verts[index++] = 0;
    
                verts[index++] = mass.bottom.cx * scale;
                verts[index++] = -mass.bottom.cy * scale;
                verts[index++] = 0;
            }
        }

        for (let j = system.getHeight() - 1; j >= 0; j--) {
            const mass = system.getPointMassAt(i + 1, j);
            if (!mass) {
                continue;
            }
            
            // (i, j) -> (i + 1, j)
            if (null !== mass.right) {
                verts[index++] = mass.cx * scale;
                verts[index++] = -mass.cy * scale;
                verts[index++] = 0;
    
                verts[index++] = mass.right.cx * scale;
                verts[index++] = -mass.right.cy * scale;
                verts[index++] = 0;
            }
    
            // (i, j) -> (i, j + 1)
            if (null !== mass.bottom) {
                verts[index++] = mass.cx * scale;
                verts[index++] = -mass.cy * scale;
                verts[index++] = 0;
    
                verts[index++] = mass.bottom.cx * scale;
                verts[index++] = -mass.bottom.cy * scale;
                verts[index++] = 0;
            }
        }
    }

    line.geometry.attributes.position.needsUpdate = true;
    line.geometry.computeBoundingBox();
}

scene.add(line);

// randomly stick stuff around
const pins = 3 + Math.floor(Math.random() * 10);
for (let i = 0; i < pins; i++) {
    const sphere = new THREE.Mesh(
        new THREE.SphereGeometry(5, 10, 10),
        new THREE.MeshBasicMaterial({color:0x333333})
    );
    sphere.geometry.computeBoundingSphere();
    
    const x = Math.floor(Math.random() * system.getWidth());
    const y = Math.floor(Math.random() * system.getHeight());
    const mass = system.getPointMassAt(x, y);
    mass.invMass = 0;

    sphere._mass = mass;
    scene.add(sphere);
    groups.push({ group: sphere, mass });
}

const updateGroupPosition = ({ group, mass }) => group.position.set(
    mass.cx * scale + offset.x,
    -mass.cy * scale + offset.y,
    0);

const updateGroups = () => groups.forEach(updateGroupPosition);

updateGroups();
renderer.render(scene, camera);

const timeScale = 1;
const loop = () => {
    requestAnimationFrame(loop);

    system.solve(timeScale / 60);
    updateGrid();
    updateGroups();

    renderer.render(scene, camera);
}
loop();

const mouse = new THREE.Vector2();
let selectedMass;

document.body.onmousemove = evt => {
    mouse.x = (evt.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(evt.clientY / window.innerHeight) * 2 + 1;

    var raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, camera);
    var intersects = raycaster.intersectObject(plane);
    const intersection = intersects[0].point;
    const x = (intersection.x - offset.x) / scale;
    const y = (-intersection.y + offset.y) / scale;

    if (selectedMass) {
        selectedMass.cx = selectedMass.px = x;
        selectedMass.cy = selectedMass.cy = y;
    }
};

document.body.onmouseup = () => {
    if (selectedMass) {
        selectedMass.invMass = selectedMass._prevInvMass;
        selectedMass.px = selectedMass.cx;
        selectedMass.py = selectedMass.cy;
    }

    selectedMass = null;
}

const raycaster = new THREE.Raycaster();
document.body.onmousedown = evt => {
    mouse.x = (evt.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(evt.clientY / window.innerHeight) * 2 + 1; 
  
    raycaster.setFromCamera(mouse, camera);
    const query = raycaster.intersectObjects(scene.children)[0];
    const obj = query.object;

    if (obj._mass) {
        selectedMass = obj._mass;
    } else {
        const intersection = query.point;
        const x = (intersection.x - offset.x) / scale;
        const y = (-intersection.y + offset.y) / scale;
        selectedMass = system.getPointMassNearest(x, y);
    }

    selectedMass._prevInvMass = selectedMass.invMass;
    selectedMass.invMass = 0;
};