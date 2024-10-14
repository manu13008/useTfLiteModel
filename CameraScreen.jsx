import { View, Text, StyleSheet , Image, SafeAreaView, Platform, Dimensions, StatusBar }from 'react-native';
import { React, useState , useEffect, useRef, useCallback } from 'react';
import {useTensorflowModel, loadTensorflowModel} from 'react-native-fast-tflite'
import { useResizePlugin } from 'vision-camera-resize-plugin';
import {  Camera,  useCameraDevice,  useCameraPermission,  useFrameProcessor} from 'react-native-vision-camera'
import   Svg, {Rect } from 'react-native-svg';

import { useRunOnJS } from 'react-native-worklets-core';

// Mesure de performance
import { PerformanceObserver, performance } from 'react-native';

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



const MAX_FRAMES = 50;

function CameraScreen() {

/////////////////////////////////////////////////////////////////////////////////////
  // Camera Autorisation
  const [isReady, setIsReady] = useState(false);
  const { hasPermission, requestPermission } = useCameraPermission()
  const device = useCameraDevice('back')



  // Detections
  const [detections, setDetections] = useState([]);
  const detectionsRef = useRef([]);
  const { width, height } = Dimensions.get('window');


  const frameCountRef = useRef(0);
  
  const windowWidth = Dimensions.get('window').width;
  const windowHeight = Dimensions.get('window').height;

  console.log('Height and width ', windowHeight , windowWidth)



// Pour pouvoir tracer les rectangles sur l'image
  const updateDetections = useCallback((newDetections) => {
    detectionsRef.current = newDetections;
    setDetections([...newDetections]);
  }, []);

  const runOnJSUpdateDetections = useRunOnJS(updateDetections);

//////////////////////////////////////////////////////////////////

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



  const { resize } = useResizePlugin()

  const frameProcessor = useFrameProcessor(
    (frame) => {
      'worklet'
      // if (frameCountRef.current >= MAX_FRAMES) {
      //   return
      // }
      
      try {
        if (actualModel == null) {
          console.log('Model not loaded yet');
          return;
        }
        // console.log(`Running inference on frame length`, frame.toString());

    // Afficher les métadonnées de la frame
      console.log('Frame metadata:', {
      width: frame.width,
      height: frame.height,
      timestamp: frame.timestamp,
      pixelFormat: frame.pixelFormat,
      isMirrored: frame.isMirrored,
      orientation: frame.orientation,
      bytesPerRow: frame.bytesPerRow,
      planesCount: frame.planesCount,
    });

        const resized = resize(frame, {
          scale: {
            width: 320,
            height: 320,
          },
          pixelFormat: 'rgb',
          dataType: 'uint8',

        });

        for (let i =0 ; i < 15 ; i++) {
          console.log('Affichage données' , resized[i*200])
      }
        const start = performance.now();
        // Run model with given input buffer synchronously
        const outputs = actualModel.runSync([resized])

        const end = performance.now();
        const executionTime = end - start;
        
        console.log(`Temps d'exécution de : ${executionTime.toFixed(2)} ms`);

        // Interpret outputs accordingly
        const detection_boxes = outputs[0]
        const detection_classes = outputs[1]
        const detection_scores = outputs[2]
        const num_detections = outputs[3]

       

        // console.log('Results identifiers',JSON.stringify(outputs))
        // console.log('Resized object : ', JSON.stringify(resized))
        
        console.log('Boxes : ', detection_boxes)
        console.log('Scores', detection_scores)
        console.log('Classes', detection_classes)
        console.log(`Detected ${num_detections[0]} objects!`)
        frameCountRef.current += 1;

        console.log('Width', frame.width)
        console.log('Height', frame.height)

        const newDetections = []
        for (let i = 0; i < detection_boxes.length; i += 4) {
          const confidence = detection_scores[i / 4]
          
          if (confidence > 0.4) {
              // 4. Draw a red box around the detected object!
              const left = detection_boxes[i]
              const top = detection_boxes[i + 1]
              const right = detection_boxes[i + 2]
              const bottom = detection_boxes[i + 3]


              newDetections.push({
                // x: left * frame.width,
                // y: top * frame.height,
                // width : (right - left) * frame.width,
                // height: (bottom - top) * frame.height ,

                x: 400 - ( left * 400) ,
                y: top * 522,
                width : -(right - left) * 400,
                height: (bottom - top) * 522 ,


              });

          }
          
      }
              detectionsRef.current = newDetections;
              runOnJSUpdateDetections(newDetections);
              // Utiliser runOnJS pour mettre à jour l'état de manière sûre
              // runOnJS(updateDetections)(newDetections);
              // console.log('Detections', detectionsRef.current)
      } catch (error) {
        console.error('Error in frame processor:', error.message);
        console.error('Error stack:', error.stack);
        console.error('Error details:', JSON.stringify(error));
      }
      
  
  },

    [actualModel]
  )



  return (
    <View style={styles.container}>
<StatusBar translucent backgroundColor="transparent" />
{isReady && hasPermission && device != null ? (

    <View style={{ width: '100%', aspectRatio: 3/4}}>
  {/* <View style={StyleSheet.absoluteFill}> */}
  <Camera
    device={device}
    style={StyleSheet.absoluteFill}
    // style={[StyleSheet.absoluteFill, { transform: [{ rotate: '90deg' }] }]}
    isActive={true}
    isMirrored={true}
    orientation='landscapeLeft'
    frameProcessor={frameProcessor}
 
    
    // resizeMode='contain'
    
    // resolution={{ width: 640, height: 640 }}
    pixelFormat="yuv"
  />
  <Svg height={height} width={width} style={StyleSheet.absoluteFill}>
        {detectionsRef.current.map((detection, index) => (
          <Rect
            key={index}
            x={detection.x}
            y={detection.y}
            width={detection.width}
            height={detection.height}
            stroke="red" // Couleur des bords
            strokeWidth="2" // Epaisseur ligne
            fill="none" // Pas de remplissage 
          />
        ))}
      </Svg> 

</View>
        
      ) : (
        <Text>No Camera available.</Text>
      )}


      {/* <Text style={styles.text}>Welcome on the second screen!</Text>
      <Image
          source={require('./android/app/src/main/assets/photo.png')}
          style={styles.image}
          resizeMode="contain"
        /> */}


    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    // justifyContent: 'center',
    // alignItems: 'center',
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