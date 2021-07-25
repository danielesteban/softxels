import {
  Euler,
  Group,
  Raycaster,
  Vector2,
  Vector3,
} from 'three';

class Player extends Group {
  constructor({
    camera,
    renderer,
  }) {
    super();

    this.aux = {
      center: new Vector2(),
      euler: new Euler(0, 0, 0, 'YXZ'),
      direction: new Vector3(),
      forward: new Vector3(),
      right: new Vector3(),
      worldUp: new Vector3(0, 1, 0),
    };
    this.buttons = {
      primary: false,
      secondary: false,
      tertiary: false,
    };
    this.buttonState = { ...this.buttons };
    this.camera = camera;
    this.keyboard = new Vector3(0, 0, 0);
    this.pointer = new Vector2(0, 0);
    this.raycaster = new Raycaster();
    this.speed = 8;
    this.add(camera);

    this.onBlur = this.onBlur.bind(this);
    this.onKeyDown = this.onKeyDown.bind(this);
    this.onKeyUp = this.onKeyUp.bind(this);
    this.onMouseDown = this.onMouseDown.bind(this);
    this.onMouseMove = this.onMouseMove.bind(this);
    this.onMouseUp = this.onMouseUp.bind(this);
    this.onMouseWheel = this.onMouseWheel.bind(this);
    this.onPointerLock = this.onPointerLock.bind(this);
    this.requestPointerLock = this.requestPointerLock.bind(this);
    window.addEventListener('blur', this.onBlur);
    document.addEventListener('keydown', this.onKeyDown);
    document.addEventListener('keyup', this.onKeyUp);
    document.addEventListener('mousedown', this.onMouseDown);
    document.addEventListener('mousemove', this.onMouseMove);
    document.addEventListener('mouseup', this.onMouseUp);
    document.addEventListener('wheel', this.onMouseWheel, false);
    document.addEventListener('pointerlockchange', this.onPointerLock);
    renderer.addEventListener('mousedown', this.requestPointerLock);
  }

  onAnimationTick(animation) {
    const {
      aux: {
        center,
        euler,
        direction,
        forward,
        right,
        worldUp,
      },
      buttons,
      buttonState,
      camera,
      keyboard,
      isLocked,
      pointer,
      position,
      speed,
      raycaster,
    } = this;
    if (!isLocked) {
      return;
    }
    if (pointer.x !== 0 || pointer.y !== 0) {
      euler.setFromQuaternion(camera.quaternion);
      euler.y -= pointer.x * 0.003;
      euler.x -= pointer.y * 0.003;
      pointer.set(0, 0);
      const PI_2 = Math.PI / 2;
      euler.x = Math.max(-PI_2, Math.min(PI_2, euler.x));
      camera.quaternion.setFromEuler(euler);
      camera.updateMatrixWorld();
    }
    ['primary', 'secondary', 'tertiary'].forEach((button) => {
      const state = buttonState[button];
      buttons[`${button}Down`] = state && buttons[button] !== state;
      buttons[`${button}Up`] = !state && buttons[button] !== state;
      buttons[button] = state;
    });
    if (
      keyboard.x !== 0
      || keyboard.y !== 0
      || keyboard.z !== 0
    ) {
      camera.getWorldDirection(forward);
      right.crossVectors(worldUp, forward);
      position.addScaledVector(
        direction
          .set(0, 0, 0)
          .addScaledVector(right, -keyboard.x)
          .addScaledVector(worldUp, keyboard.y)
          .addScaledVector(forward, keyboard.z)
          .normalize(),
        animation.delta * speed
      );
      this.updateMatrixWorld();
    }
    raycaster.setFromCamera(center, camera);
  }

  onBlur() {
    const { buttonState, keyboard } = this;
    buttonState.primary = false;
    buttonState.secondary = false;
    buttonState.tertiary = false;
    keyboard.set(0, 0, 0);
  }

  onKeyDown({ keyCode, repeat }) {
    const { buttonState, keyboard } = this;
    if (repeat) return;
    switch (keyCode) {
      case 16:
        keyboard.y = -1;
        break;
      case 32:
        keyboard.y = 1;
        break;
      case 87:
        keyboard.z = 1;
        break;
      case 83:
        keyboard.z = -1;
        break;
      case 65:
        keyboard.x = -1;
        break;
      case 68:
        keyboard.x = 1;
        break;
      case 70:
        buttonState.tertiary = true;
        break;
      default:
        break;
    }
  }

  onKeyUp({ keyCode, repeat }) {
    const { buttonState, keyboard } = this;
    if (repeat) return;
    switch (keyCode) {
      case 16:
        if (keyboard.y < 0) keyboard.y = 0;
        break;
      case 32:
        if (keyboard.y > 0) keyboard.y = 0;
        break;
      case 87:
        if (keyboard.z > 0) keyboard.z = 0;
        break;
      case 83:
        if (keyboard.z < 0) keyboard.z = 0;
        break;
      case 65:
        if (keyboard.x < 0) keyboard.x = 0;
        break;
      case 68:
        if (keyboard.x > 0) keyboard.x = 0;
        break;
      case 70:
        buttonState.tertiary = false;
        break;
      default:
        break;
    }
  }

  onMouseDown({ button }) {
    const { buttonState, isLocked } = this;
    if (!isLocked) {
      return;
    }
    switch (button) {
      case 0:
        buttonState.primary = true;
        break;
      case 1:
        buttonState.tertiary = true;
        break;
      case 2:
        buttonState.secondary = true;
        break;
      default:
        break;
    }
  }

  onMouseMove({ movementX, movementY }) {
    const { isLocked, pointer } = this;
    if (!isLocked) {
      return;
    }
    pointer.x += movementX;
    pointer.y += movementY;
  }

  onMouseUp({ button }) {
    const { buttonState, isLocked } = this;
    if (!isLocked) {
      return;
    }
    switch (button) {
      case 0:
        buttonState.primary = false;
        break;
      case 1:
        buttonState.tertiary = false;
        break;
      case 2:
        buttonState.secondary = false;
        break;
      default:
        break;
    }
  }

  onMouseWheel({ deltaY }) {
    const { speed, isLocked } = this;
    if (!isLocked) {
      return;
    }
    const { minSpeed, speedRange } = Player;
    const logSpeed = Math.min(
      Math.max(
        ((Math.log(speed) - minSpeed) / speedRange) - (deltaY * 0.0003),
        0
      ),
      1
    );
    this.speed = Math.exp(minSpeed + logSpeed * speedRange);
  }

  onPointerLock() {
    this.isLocked = !!document.pointerLockElement;
    document.body.classList[this.isLocked ? 'add' : 'remove']('pointerlock');
    if (!this.isLocked) {
      this.onBlur();
    }
  }

  requestPointerLock() {
    const { isLocked } = this;
    if (isLocked) {
      return;
    }
    document.body.requestPointerLock();
  }
}

Player.minSpeed = Math.log(4);
Player.maxSpeed = Math.log(40);
Player.speedRange = Player.maxSpeed - Player.minSpeed;

export default Player;
