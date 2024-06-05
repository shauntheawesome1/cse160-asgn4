class Camera {
    constructor() {
        this.eye = new Vector3([0, 0, 3]);
        this.at = new Vector3([-0.25, -0.15, 0.0]); 
        this.up = new Vector3([0, 1, 0]);
        this.viewMatrix = new Matrix4();
    }

    updateCamera(theta, phi) {
        var radius = Math.sqrt((this.eye.elements[0] - this.at.elements[0]) ** 2 + (this.eye.elements[1] - this.at.elements[1]) ** 2 + (this.eye.elements[2] - this.at.elements[2]) ** 2); // Define radius as length from center (at) to edge of sphere (eye)
        phi = Math.max(0.0001, Math.min(Math.PI - 0.0001, phi));

        this.eye.elements[0] = this.at.elements[0] + radius * Math.sin(phi) * Math.sin(theta);
        this.eye.elements[1] = this.at.elements[1] + radius * Math.sin(phi) * Math.cos(phi);
        this.eye.elements[2] = this.at.elements[2] + radius * Math.sin(phi) * Math.cos(theta);

        this.viewMatrix.setLookAt(
            this.eye.elements[0], this.eye.elements[1], this.eye.elements[2],
            this.at.elements[0], this.at.elements[1], this.at.elements[2],
            this.up.elements[0], this.up.elements[1], this.up.elements[2],
        );
    }
}