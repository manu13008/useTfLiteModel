import { View, Text, StyleSheet , Image, SafeAreaView, Platform, Dimensions }from 'react-native';
import { React, useState , useEffect, useRef } from 'react';
import {useTensorflowModel, loadTensorflowModel} from 'react-native-fast-tflite'
import { useResizePlugin } from 'vision-camera-resize-plugin';
import {  Camera,  useCameraDevice,  useCameraPermission,  useFrameProcessor} from 'react-native-vision-camera'

// Import traçage de formes sur l'ecran
// import { Canvas, Circle, useCanvas, usePaint , useFont } from '@shopify/react-native-skia';

function tensorToString(tensor) {
  return `\n  - ${tensor.dataType} ${tensor.name}[${tensor.shape}]`
}


function modelToString(model) {
  return (
    `TFLite Model (${model.delegate}):\n` +
    `- Inputs: ${model.inputs.map(tensorToString).join('')}\n` +
    `- Outputs: ${model.outputs.map(tensorToString).join('')}`
  )
}

const MAX_FRAMES = 100;

function CameraScreen() {

/////////////////////////////////////////////////////////////////////////////////////
  // Camera Autorisation
  const [isReady, setIsReady] = useState(false);
  const { hasPermission, requestPermission } = useCameraPermission()
  const device = useCameraDevice('back')

  const frameCountRef = useRef(0);
  const { width, height } = Dimensions.get('window');

  useEffect(() => {
    (async () => {
      const status = await Camera.requestCameraPermission();
      console.log('Camera status',status);
      if (status !== 'authorized') {
        await requestPermission();
      }
    })();
  }, []);


/////////////////////////////////////////////////////////////////////////////////////


  // Loading Model
  // const model  = useTensorflowModel(require('./android/app/src/main/assets/best_float16.tflite'))//model path
    const model  = useTensorflowModel(require('./android/app/src/main/assets/efficientDet.tflite'))//model path
  // const model  = useTensorflowModel(require('./android/app/src/main/assets/object_detection_mobile_object_localizer_v1_1_default_1.tflite'))//model path
  // const model  = useTensorflowModel(require('./android/app/src/main/assets/mobilenet_v2_0.35_96.tflite'))//model path
  
  const actualModel = model.state === 'loaded' ? model.model : undefined
  // const {model2, state2} = loadTensorflowModel({url : 'https://kaggle/input/efficientdet/tflite/lite0-detection-default/1.tflite'})


  useEffect(() => {
    if (actualModel == null || typeof actualModel.runSync !== 'function') {
      console.log('Model not fully loaded or initialized');
      return;
    }
    console.log('Etat modèle',actualModel)
    console.log(`Model loaded! Shape:\n${modelToString(actualModel)}]`)
  }, [actualModel])



  useEffect(() => {
    if (hasPermission && actualModel != null) {
      setIsReady(true);
      console.log('Setting isReady to true');
    }
  }, [hasPermission, actualModel]);



  console.log('Model1', model, actualModel)
  console.log(`Model: ${model.state} (${model.model != null})`)

  const { resize } = useResizePlugin()

  const frameProcessor = useFrameProcessor(
    (frame) => {
      'worklet'
      if (frameCountRef.current >= MAX_FRAMES) {
        return
      }
      
      try {
        if (actualModel == null) {
          console.log('Model not loaded yet');
          return;
        }
        // console.log(`Running inference on frame`, frame.toString());
        const resized = resize(frame, {
          scale: {
            width: 320,
            height: 320,
          },
          pixelFormat: 'rgb',
          dataType: 'uint8',
        });

        // console.log('Resized object : ', JSON.stringify(resized))
        // console.log('Resized object structure:', Object.keys(resized));

        

        // 2. Run model with given input buffer synchronously
        const outputs = actualModel.runSync([resized])

        // 3. Interpret outputs accordingly
        const detection_boxes = outputs[0]
        const detection_classes = outputs[1]
        const detection_scores = outputs[2]
        const num_detections = outputs[3]

        // console.log('Results identifiers',JSON.stringify(outputs))
        // const num_detections = result[3]?.[0] ?? 0;
        
        console.log('Boxes : ', detection_boxes)
        console.log('Scores', detection_scores)
        console.log('Classes', detection_classes)
        console.log(`Detected ${num_detections[0]} objects!`)
        frameCountRef.current += 1;


        for (let i = 0; i < detection_boxes.length; i += 4) {
          const confidence = detection_scores[i / 4]
          if (confidence > 0.7) {
              // 4. Draw a red box around the detected object!
              const left = detection_boxes[i]
              const top = detection_boxes[i + 1]
              const right = detection_boxes[i + 2]
              const bottom = detection_boxes[i + 3]
              // const rect = SkRect.Make(left, top, right, bottom)
              // canvas.drawRect(rect, SkColors.Red)
          }
      }
        
      
      } catch (error) {
        console.error('Error in frame processor:', error);
        console.error('Error in frame processor:', error.message);
        console.error('Error stack:', error.stack);
        console.error('Error details:', JSON.stringify(error));
      }
      
    

    
  },

    [actualModel]
  )

  


  return (
    <View style={styles.container}>
      <Text style={styles.text}>Welcome on the second screen!</Text>
      <Image
          source={require('./android/app/src/main/assets/photo.png')}
          style={styles.image}
          resizeMode="contain"
        />
        {isReady && hasPermission && device != null ? (
  <View style={StyleSheet.absoluteFill}>
  <Camera
    device={device}
    style={StyleSheet.absoluteFill}
    isActive={true}
    frameProcessor={frameProcessor}
    pixelFormat="yuv"
  />
  {/* <Canvas style={StyleSheet.absoluteFill}>
    <Circle
      cx={width / 2}
      cy={height / 2}
      r={50}
      color="red"
    />
  </Canvas> */}
</View>
        
      ) : (
        <Text>No Camera available.</Text>
      )}

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    fontSize: 20,
  },
  image: {
    width: 300,  
    height: 200, 
    marginBottom: 20,
  },
});

export default CameraScreen;