importScripts('../../assets/subvision-core/subvision_core.js');

let instance: any = null;

addEventListener('message', (e) => {
  const {type} = e.data;
  if (type === 'loadSubvisionCore') {
    loadSubvisionCore().then(() => {
      self.postMessage({status: 'loaded'});
    });
  } else if (type === 'processTargetImage') {
    loadSubvisionCore().then(() => {
      const result = instance.processTargetImage(e.data.width, e.data.height, e.data.data);
      self.postMessage({
        annotatedImage: {
          data: result.annotatedImage.data.slice(0),
          rows: result.annotatedImage.rows,
          columns: result.annotatedImage.columns,
        },
        impacts: result.impacts,
      });
    });
  }
})

async function loadSubvisionCore() {
  if (instance) {
    return instance;
  } else {
    // @ts-ignore
    instance = await SubvisionCV();
  }
}
