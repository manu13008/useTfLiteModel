import { View, Text, StyleSheet , Image, SafeAreaView, Platform, Dimensions, StatusBar }from 'react-native';
import { React, useState , useEffect, useRef, useCallback } from 'react';
import {useTensorflowModel, loadTensorflowModel} from 'react-native-fast-tflite'
import { useResizePlugin } from 'vision-camera-resize-plugin';
import {  Camera,  useCameraDevice,  useCameraPermission,  useFrameProcessor} from 'react-native-vision-camera'
import   Svg, {Rect } from 'react-native-svg';

import { useRunOnJS } from 'react-native-worklets-core';

// Suavegarde de l'image
import RNFS from 'react-native-fs';


//Import Image assets
import RNPhotoManipulator from 'react-native-photo-manipulator';

// Mesure de performance
import { performance } from 'react-native';


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

function CameraScreen2() {

/////////////////////////////////////////////////////////////////////////////////////
  // Camera Autorisation
  const [isReady, setIsReady] = useState(false);
  const { hasPermission, requestPermission } = useCameraPermission()
  const device = useCameraDevice('back' )
  // console.log('Device', device)



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
//   const model  = useTensorflowModel(require('./android/app/src/main/assets/best_float16.tflite'))//model path
  // const model  = useTensorflowModel(require('./android/app/src/main/assets/yolov8n_float16_googleColab.tflite'))//model path
  const model  = useTensorflowModel(require('./android/app/src/main/assets/yolov11n_golf_float16.tflite'))//model path
  // const model  = useTensorflowModel(require('./android/app/src/main/assets/yolo11n_int8.tflite'))//model path
  const actualModel = model.state === 'loaded' ? model.model : undefined






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


const saveFrameToFile = useCallback(async (frameData) => {
    try {
      const fileName = `frame_${Date.now()}.raw`;
      const filePath = `${RNFS.ExternalDirectoryPath}/${fileName}`;
      
  
console.log('Valeur aléatoire', frameData.length)
console.log('Type frameData', typeof frameData)

// Convertir les données en format texte
let textContent = '';
for (let i = 0; i < frameData.length; i += 3) {
  textContent += `${frameData[i]},${frameData[i+1]},${frameData[i+2]}\n`;
  // if (i < 50) {
  //   console.log(frameData[i])
  // }
}

// Écrire dans le fichier texte
await RNFS.writeFile(filePath, textContent, 'utf8');
console.log('File written successfully');

// Vérifier le fichier après l'écriture
const fileExists = await RNFS.exists(filePath);
console.log('File exists after writing:', fileExists);

if (fileExists) {
  const fileSize = await RNFS.stat(filePath);
  console.log('File size after writing:', fileSize.size, 'bytes');
}

console.log('Frame data saved to', filePath);


      // Convertir Uint8Array en chaîne base64
    //   const base64Data = Buffer.from(uint8Array).toString('base64');
      
    //   await RNFS.writeFile(filePath, base64Data, 'base64');
    //   console.log('Frame data saved to', filePath);
    } catch (error) {
      console.error('Error saving frame data:', error);
    }
  }, []);

  const runOnJSSaveFrameToFile = useRunOnJS(saveFrameToFile);
  



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



    console.log(`Running inference on frame length`, frame.toString());


    const startResize = performance.now();


        const resized = resize(frame, {
          scale: {
            width: 640 ,
            height: 640 ,
          },
          pixelFormat: 'rgb',
          dataType: 'float32',
          rotation : '90deg',
 
        });

        const endResize = performance.now();
        const executionTimeResize = endResize - startResize;
        console.log(`Resize - Temps d'exécution de : ${executionTimeResize.toFixed(2)} ms`);

        // for (let i =0 ; i < 15 ; i++) {
        //     console.log('Affichage données' , resized[i*200])
        // }

        // console.log(`Resized information`, resized.length);

    // const array = Object.values(resized);
    // console.log('type array', array.slice(0,10))

    // Convertir les données float32 en uint8
    // const uint8Array = []
    // console.log('Type de larray', typeof uint8Array)
    // for (let i = 0; i < array.length; i++) {
    //   uint8Array[i] = Math.min(255, Math.max(0, Math.round(array[i] * 255)));
    // }

    // console.log('Deuxième valeur unint8', uint8Array[5005])
    // console.log('Array length', uint8Array.length)

  // Sauvegarder la frame
  // runOnJSSaveFrameToFile(uint8Array);

    
        const start = performance.now();
        // Run model with given input buffer synchronously
        const outputs = actualModel.runSync([resized])
        const end = performance.now();
        const executionTime = end - start;
        console.log(`Inference - Temps d'exécution de : ${executionTime.toFixed(2)} ms`);



        // const first100Values = [];
        // for (let i = 0; i < 100 ; i++) {
        //   const key = i.toString();
        //   const value = outputs['0'][key];
        //   first100Values.push(value);
        // }
      



        const startPost = performance.now();

        const keys = Object.keys(outputs['0']).sort((a, b) => parseInt(a) - parseInt(b));
        // Crée un nouveau tableau avec les valeurs dans l'ordre des clés triées
         const valeurs = keys.map(key => outputs['0'][key]);
         console.log("Longueur valeur", valeurs.length)


    const x = valeurs.slice(0,8400)
    const y = valeurs.slice(8400,8400*2)
    const width = valeurs.slice(8400*2,8400*3)
    const height = valeurs.slice(8400*3,8400*4)
    const class1 = valeurs.slice(8400*4,8400*5)
    const class2 = valeurs.slice(8400*5,8400*6)



// Créer un tableau d'objets avec les valeurs et leurs indices
const indexedClass1 = class1.map((value, index) => ({ value, index }));

// Trier ce tableau par ordre décroissant des valeurs
indexedClass1.sort((a, b) => b.value - a.value);



// Créer un tableau d'objets avec les valeurs et leurs indices
const indexedClass2 = class2.map((value, index) => ({ value, index }));

// Trier ce tableau par ordre décroissant des valeurs
indexedClass2.sort((a, b) => b.value - a.value);


console.log(`Valeur Ball: ${indexedClass1[0].value}, Index original: ${indexedClass1[0].index}`)
console.log(`X : ${x[indexedClass1[0].index]} , Y : ${y[indexedClass1[0].index]} , Width : ${width[indexedClass1[0].index]} , Height : ${height[indexedClass1[0].index]}  `)

console.log(`Valeur PF: ${indexedClass2[0].value}, Index original: ${indexedClass2[0].index}`)
console.log(`X : ${x[indexedClass2[0].index]} , Y : ${y[indexedClass2[0].index]} , Width : ${width[indexedClass2[0].index]} , Height : ${height[indexedClass2[0].index]}  `)




// Afficher les 10 premières valeurs triées avec leurs indices originaux
// console.log("Top 1 valeurs triées avec leurs indices originaux:");
// for (let i = 0; i < 10 && i < indexedClass2.length; i++) {
//     console.log(`Valeur: ${indexedClass2[i].value}, Index original: ${indexedClass2[i].index}`);
// }





    // const reshaped = []
    // for( let i = 0; i < 8400; i++) {
    //     const detection = []
    //     detection.push(x[i])
    //     detection.push(y[i])
    //     detection.push(width[i])
    //     detection.push(height[i])
    //     detection.push(class1[i])
    //     detection.push(class2[i])
    //     reshaped.push(detection)
    // }

// console.log('X', x.slice(0,10))
// console.log('Y', y.slice(0,10))
// console.log('Width', width.slice(0,10))
// console.log('Height', height.slice(0,10))
// console.log('Class1', class1.slice(0,10))
// console.log('Class2', class2.slice(0,10))



   // Trier par le 5ème élément (indice 4) dans l'ordre décroissant
    // reshaped.sort((a, b) => b[4] - a[4]);
    // console.log('Reshape', reshaped.slice(0,2))



       
        // frameCountRef.current += 1;

        const reshaped =[]
        reshaped.push([x[indexedClass1[0].index], y[indexedClass1[0].index],width[indexedClass1[0].index],height[indexedClass1[0].index],indexedClass1[0].value])
        reshaped.push([x[indexedClass2[0].index], y[indexedClass2[0].index],width[indexedClass2[0].index],height[indexedClass2[0].index],indexedClass2[0].value])

        const newDetections = []
        for (let i = 0; i < 2; i += 1) {
          const detection = reshaped[i]
          
        // const top = (detection[0] - (0.5 * detection[2])) * 392
        // const left =  (detection[1] -  (0.5 * detection[3])) * 522
        // const height = detection[2] * 392
        // const width = detection[3] * 522

        const left = (detection[0] - (0.5 * detection[2]))* 392
        const top =  (detection[1] -  (0.5 * detection[3])) * 480
        const width = detection[2] * 392
        const height = detection[3] * 522

        console.log(`X : ${left} ; Y : ${top} , Width : ${width} , Height : ${height}`)

        // const left = (detection[1] - detection[3] / 2) * 522;
        // const top = (1 - (detection[0] + detection[2] / 2)) * 392;
        // const width = detection[3] * 522;
        // const height = detection[2] * 392;


 

            newDetections.push({
         x: left ,
         y: top,
         width : width,
         height: height ,



        //  x: 0 ,
        //  y: 400,
        //  width : 50,
        //  height: 123 ,



            })


              };


              const endPost = performance.now();
              const executionTimePost = endPost - startPost;
              console.log(`Post - Temps d'exécution de : ${executionTimePost.toFixed(2)} ms`);
  

              detectionsRef.current = newDetections;
              runOnJSUpdateDetections(newDetections);
              // Utiliser runOnJS pour mettre à jour l'état de manière sûre

              console.log('Detections', detectionsRef.current)
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

export default CameraScreen2;