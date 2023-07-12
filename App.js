import React, { useEffect, useRef, useState } from "react";
import { StyleSheet, View, Text, StatusBar } from "react-native";
import { Camera } from "expo-camera";
import { Icon, Button } from "react-native-elements";
import { manipulateAsync }  from 'expo-image-manipulator';
import { debounce } from 'lodash'

export default function App() {
  const cameraRef = useRef(null);
  const [hasPermission, setHasPermission] = useState(null);
  const [infoText, setInfoText] = useState("Place ");
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [boundingBox,setBoundingBox] = useState(null);

  useEffect(() => {
    (async () => {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(status === "granted");
    })();
  }, []);

  useEffect(() => {
    let timeoutId;

    const processImage = async () => {
      if (cameraRef.current) {
        try {
          const photo = await cameraRef.current.takePictureAsync({
            quality: 0.1, // Lower quality value for faster processing
          });

          const manipulatedImage = await manipulateAsync(
            photo.uri,
            [{ resize: { width: 250 } }],
            { compress: 0.2, format: "jpeg" }
          );

          // console.log(manipulatedImage);

          const blob = await fetch(manipulatedImage.uri).then((r) => r.blob());
  
          // Process the image
          processBlob(blob).finally(() => {
            // Capture the next image after the previous image has been processed
            // timeoutId = setInterval(processImage, 1500); // Decreased timeout duration
          });
        } catch (error) {
          console.log(error)
        }
      }
    };

    const processBlob = async (blob) => {
      const predictionKey = "75deb4a7d3c64b8e9f9cb69984efbc6f";
      const predictionURL =
        "https://northeurope.api.cognitive.microsoft.com/customvision/v3.0/Prediction/c066cfd2-2ebc-4a0b-9250-fb6470db2a19/detect/iterations/Iteration23/image";

      const MAX_RETRIES = 3;
      const retryDelays = Array(MAX_RETRIES)
        .fill()
        .map((_, i) => Math.pow(2, i) * 1000); // [1000, 2000, 4000]

      // for (let i = 0; i <= MAX_RETRIES; i++) {
        try {
          const response = await fetch(predictionURL, {
            method: "POST",
            headers: {
              "Prediction-Key": predictionKey,
              "Content-Type": "application/octet-stream",
            },
            body: blob,
          });
          // console.log(response.status);
          // if (response.status === 429) {
          //   // Azure is rate limiting, wait for the delay and then continue the loop to retry
          //   await new Promise((resolve) => setTimeout(resolve, retryDelays[i]));
          //   continue;
          // }

          const data = await response.json();

          

          console.log(data);
          if (data.predictions && data.predictions.length > 0) {
            let recycledPrediction = data.predictions.find(
              (p) => p.tagName === "recycled"
            );
            let onPositionPrediction = data.predictions.find(
              (p) => p.tagName === "on-position"
            );
            if (recycledPrediction && recycledPrediction.probability > 0.8) {
              setCurrentStep(3);
              setBoundingBox(recycledPrediction.boundingBox);
            } else if (
              onPositionPrediction &&
              onPositionPrediction.probability > 0.5
            ) {
              setBoundingBox(null);
              setCurrentStep(2);
            } else {
              setBoundingBox(null);
              setCurrentStep(1);
            }
          }
          // Successful request, break out of the loop
          // break;
        } catch (error) {
          console.error(error);
        }
      // }
    };

    const debouncedProcessImage = debounce(processImage, 50); 

    if (hasPermission) {
      timeoutId = setInterval(debouncedProcessImage,1500); // Initial capture
    }
    console.log(hasPermission)
    return () => {
      clearTimeout(timeoutId);
    };
  }, [hasPermission, isProcessing]);

  useEffect(() => {
    switch (currentStep) {
      case 1:
        setInfoText("1. Align ");
        break;
      case 2:
        setInfoText("2. Drop .");
        break;
      case 3:
        setInfoText("3. succeeded");
        break;
      default:
        setInfoText("Align ");
    }
  }, [currentStep]);

  if (hasPermission === null) {
    return <View />;
  }

  if (hasPermission === false) {
    return <Text>No access to camera</Text>;
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <Camera style={styles.camera} ref={cameraRef} ratio="4:3" />
      <View style={styles.centeredView}>
        {
          boundingBox &&<View style={{
                          borderWidth:2,
                          borderColor:'green',
                          left: 50,
                          top: 50,
                          width: 50,
                          height: 50,
                        }}/>
        }
        <View style={styles.navbar}>
          <Button
            type="clear"
            icon={
              <Icon
                name="recycle"
                type="font-awesome"
                color={currentStep === 1 ? "#32CD32" : "#808080"}
                size={40}
              />
            }
          />
          <Button
            type="clear"
            icon={
              <Icon
                name="hand-paper-o"
                type="font-awesome"
                color={currentStep === 2 ? "#32CD32" : "#808080"}
                size={40}
              />
            }
          />
          <Button
            type="clear"
            icon={
              <Icon
                name="check"
                type="font-awesome"
                color={currentStep === 3 ? "#32CD32" : "#808080"}
                size={40}
              />
            }
          />
        </View>
        <Text style={styles.infoText}>{infoText}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
  },
  navbar: {
    flexDirection: "row",
    justifyContent: "space-around",
    width: "100%",
  },
  camera: {
    flex: 1,
  },
  infoText: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "bold",
    textAlign: "center",
    padding: 20,
    borderRadius: 10,
    backgroundColor: "rgba(52, 52, 52, 0.8)", // semi-transparent dark grey color
  },
  centeredView: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    position: "absolute",
    bottom: 50,
    left: 20,
    right: 20,
    height: "auto",
  },
});
