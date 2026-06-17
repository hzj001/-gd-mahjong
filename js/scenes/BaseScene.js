import Emitter from '../libs/tinyemitter';

export default class BaseScene extends Emitter {
  constructor(name) {
    super();
    this.name = name;
  }

  enter() {}

  exit() {}

  update() {}

  render() {}

  onTouchStart() {}

  onTouchEnd() {}

  onResize() {}
}
