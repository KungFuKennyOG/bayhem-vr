// Paris taxi with the driver's door open (the bridge-jam car): ?mod=/model-test/l5/taxiopen.js&fn=taxiOpen
import { buildCar } from '/src/levels/downtown-haven/cars.js';
export function taxiOpen(seed = 102) { return { root: buildCar('taxi', { seed, city: 'paris', doorOpen: true }).root }; }
