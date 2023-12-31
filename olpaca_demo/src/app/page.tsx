"use client";
import { useState } from "react";
import { useChat } from "ai/react";
import Head from "next/head";
import { Loader } from "@googlemaps/js-api-loader";
import { PromptTemplate } from "langchain/prompts";
import { RunnableSequence } from "langchain/schema/runnable";

import { fetchWeatherInfo, fetchForecastWeather } from "./api/WeatherData";
import { templateBuilder, llmCommand, parser } from "./utils/llm";
import { runInference } from "./utils/sagemaker";
import FilterMenu from "./components/MapMenu";
import moment from 'moment';
import DataFrame from 'dataframe-js';
import axios from 'axios';


export default function Home() {
  const [outputText, setOutputText] = useState("");
  const [inputSex, setSex] = useState("");
  const [inputAge, setAge] = useState("");
  const [inputHeight, setHeight] = useState("");
  const [inputWeight, setWeight] = useState("");
  const [inputExerciseFreq, setExerciseFreq] = useState("");
  //const [predictedTemperatures, setPredictedTemperatures] = useState<string[]>();

  // const temporary_lat = "-37.804874";
  // const temporary_long = "144.96259";
  const [temperatures, setTemperatures] = useState<string[]>([]);
  const [selectedMode, setSelectedMode] = useState("");

  // @ts-ignore google.maps.plugins
  const loader = new Loader({
    apiKey: process.env.GOOGLE_MAPS_API_KEY ?? "",
    version: "weekly",
  });

  const handlePredictions = async () => {
    console.log(locationTimeMap)
    for (const info of locationTimeMap.keys()) {
      console.log(info)
      const weatherData = await fetchForecastWeather(info);
      console.log(weatherData)
      const {
        mintemp_c,
        maxtemp_c,
        precip_mm,
        sunshine,
        gust_kph,
        daily_will_it_rain,
        tom_will_it_rain,
        wind_kph,
        humidity,
        pressure_md,
        cloud,
        temp_c,
      } = weatherData.current;
      const inputFeatures : {
        sex: string;
        age: number;
        height: number;
        weight: number;
        freqOfExercise: number;
        PersonID: string;
        mintemp_c: number;
        maxtemp_c: number;
        precip_mm: number;
        sunshine: number;
        gust_kph: number;
        daily_will_it_rain: string;
        tom_will_it_rain: string;
        wind_kph: number;
        humidity: number;
        pressure_md: number;
        cloud: number;
        temp_c: number;
      } = {
          sex: String(inputSex),
          age: Number(inputAge),
          height: Number(inputHeight),
          weight: Number(inputWeight),
          freqOfExercise: Number(inputExerciseFreq),
          PersonID: "1",
          mintemp_c: Number(mintemp_c),
          maxtemp_c: Number(maxtemp_c),
          precip_mm: Number(precip_mm),
          sunshine: Number(sunshine),
          gust_kph: Number(gust_kph),
          daily_will_it_rain: String(daily_will_it_rain),
          tom_will_it_rain: String(tom_will_it_rain),
          wind_kph: Number(wind_kph),
          humidity: Number(humidity),
          pressure_md: Number(pressure_md),
          cloud: Number(cloud),
          temp_c: Number(temp_c),
        };
      try {
        const response = await runInference(inputFeatures);
        console.log("Prediction Result:", response);
      } catch (error) {
        console.error("Error getting prediction:", error);
      };
    }
    
  };

  const handleSexChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setSex(event.target.value);
  };

  const handleAgeChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setAge(event.target.value);
  };

  const handleHeightChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setHeight(event.target.value);
  };

  const handleWeightChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setWeight(event.target.value);
  };

  const handleExerciseFreqChange = (
    event: React.ChangeEvent<HTMLSelectElement>,
  ) => {
    setExerciseFreq(event.target.value);
  };

  var locationTimeMap = new Map<string, Date>();
  var latLngList;
  const handleApplyFilters = (
    origin: string,
    destination: string,
    stops: string[],
    mode: string,
    isDepartNow: boolean,
    departDateTime: string,
    avoidOptions: string[],
  ) => {
    // update map data
    setSelectedMode(mode);
    loader.load().then(async () => {
      const { Map } = (await google.maps.importLibrary(
        "maps",
      )) as google.maps.MapsLibrary;

      const { DirectionsService, TravelMode, DirectionsRenderer } =
        (await google.maps.importLibrary(
          "routes",
        )) as google.maps.RoutesLibrary;

      var directions = new DirectionsService();
      var routeMap = new DirectionsRenderer();

      map = new Map(document.getElementById("map") as HTMLElement);
      routeMap.setMap(map);

      const waypts: google.maps.DirectionsWaypoint[] = [];
      for (let i = 0; i < stops.length; i++) {
        waypts.push({
          location: stops[i],
          stopover: true
        });
      }
      var travelMode;
      switch(mode) {
        case "WALKING":
          travelMode = google.maps.TravelMode.WALKING
          break;
        case "DRIVING":
          travelMode = google.maps.TravelMode.DRIVING
          break;
        case "BICYCLING":
          travelMode = google.maps.TravelMode.BICYCLING
          break;
        case "TRANSIT":
          travelMode = google.maps.TravelMode.TRANSIT
          break;
        default:
          travelMode = google.maps.TravelMode.DRIVING
      }

      var mapsRequest = {
        origin: origin,
        destination: destination,
        waypoints: waypts,
        travelMode: travelMode
      };

      await directions.route(mapsRequest, function (response, status) {
        if (status == "OK") {
          console.log(response)
          routeMap.setDirections(response);
          if (response?.routes != null) {
            locationTimeMap = calculateEstimatedTime(response?.routes, departDateTime);
            console.log(locationTimeMap)

            latLngList = createLatLngList(response?.routes);
            console.log("check below");
            console.log(latLngList);
          }
        }
      });
    });
  };

  const handleGetWeatherData = () => {
    fetchWeatherInfo("-37.804874", "144.96259");
  };

  const handleGenerateOutput = async () => {
    try {
      const locations = [
        "1 Austin Crescent East",
        "Melbourne Central",
        "St Kilda",
      ];
      const temperatures = ["25", "29", "27"];
      const windSpeeds = ["6" , "15", "15"];
      const ifRain = ["0", "1", "0"];

      const locationDict: Record<string, string> = {};
      const temperatureDict: Record<string, string> = {};
      const windDict: Record<string, string> = {};
      const ifRainDict: Record<string, string> = {};
      locations.forEach((location, index) => {
        locationDict[`location${index}`] = location;
      });
      temperatures.forEach((temperature, index) => {
        temperatureDict[`temperature${index}`] = temperature;
      });
      windSpeeds.forEach((windSpeed, index) => {
        windDict[`windSpeed${index}`] = windSpeed;
      });
      ifRain.forEach((ifRain, index) => {
        ifRainDict[`ifRain${index}`] = ifRain;
      });
      const inputValues: Record<string, string> = {
        ...locationDict,
        ...temperatureDict,
        ...windDict,
        ...ifRainDict,
        style: "casual",
        mode: selectedMode, 
        sex: "female",
        age: "20"
      };
      const template = templateBuilder(locations.length);

      const prompt = PromptTemplate.fromTemplate(template);

      const chain = RunnableSequence.from([prompt, llmCommand, parser]);

      const response = await chain.invoke({
        ...inputValues,
        format_instructions: parser.getFormatInstructions(),
      });

      const { weatherSummary, clothesRecommendation } = response;
      const outputText = `Weather Summary: ${weatherSummary}\n\nClothes Recommendation: ${clothesRecommendation}`;
      setOutputText(outputText);
      console.log(typeof response);
    } catch (error) {
      console.log(error);
    }
  };

  const { messages, input, handleInputChange, handleSubmit } = useChat();

  let map;
  loader.load().then(async () => {
    const { Map } = (await google.maps.importLibrary(
      "maps",
    )) as google.maps.MapsLibrary;

    // Function for running the google maps api
    map = new Map(document.getElementById("map") as HTMLElement, {
      center: { lat: -37.804874, lng: 144.96259 },
      zoom: 14,
    });
  });

  return (
    <div>
      <Head>
        <script
          src={`https://maps.googleapis.com/maps/api/js?key=${process.env.GOOGLE_MAPS_API_KEY}&callback=initMap`}
          async
          defer
        />
        {/* <script
          async
          defer
          src={`https://maps.googleapis.com/maps/api/js?key=${process.env.GOOGLE_MAPS_API_KEY}&libraries=places`}
          type="text/javascript"
        /> */}
      </Head>
      <main>
        <h1
          className="animate-in mb-4 text-2xl font-extrabold md:text-3xl lg:text-4xl"
          style={{ "--index": 1 } as React.CSSProperties}
        >
          <span className="text-transparent bg-clip-text bg-gradient-to-r to-emerald-600 from-sky-400">
            Wear
          </span>
          ther
        </h1>
        <p
          className="animate-in text-sm font-normal lg:text-md"
          style={{ "--index": 2 } as React.CSSProperties}
        >
          Step into style with Wearther, your ultimate travel companion n the world of fashion. Unleash the power of personalised outift recommendations based on real-time weather conditions and your unique preferences. Beyond just forecasting the weather, Wearther curates the perfect wardrobe for your journey, ensuring you stay comfortable and chic no matter where your adventures take you. Seamlessly blending fashion and functionality, this innovative app transforms your daily clothing decisions into a delight experience.
        </p>
        <hr className="h-px my-4 bg-secondary border-0" />
        <div className="flex flex-row w-full">
          <div
            className="animate-in flex flex-row justify-center w-full h-[500px]"
            style={{ "--index": 3 } as React.CSSProperties}
            id="map"
          ></div>
          <FilterMenu onApply={handleApplyFilters} />
        </div>
        <div
          className="animate-in flex sm:flex-row flex-col justify-center mt-8 gap-y-2"
          style={{ "--index": 4 } as React.CSSProperties}
        >
          <div className="container flex flex-col mx-auto h-[100px]">
            <label htmlFor="sex" className="text-md font-semibold mb-2">
              Sex
            </label>
            <textarea
              id="sex"
              className="border border-primary rounded-lg p-2 w-[150px] h-11 resize-none"
              input={inputSex}
              onChange={handleSexChange}
              placeholder="Enter sex"
            />
          </div>

          <div className="container flex flex-col mx-auto h-[100px]">
            <label htmlFor="age" className="text-md font-semibold mb-2">
              Age
            </label>
            <textarea
              id="age"
              className="border border-primary rounded-lg p-2 w-[150px] h-11 resize-none"
              input={inputAge}
              onChange={handleAgeChange}
              placeholder="Enter age"
            />
          </div>

          <div className="container flex flex-col mx-auto h-[100px]">
            <label htmlFor="height" className="text-md font-semibold mb-2">
              Height
            </label>
            <textarea
              id="height"
              className="border border-primary rounded-lg p-2 w-[150px] h-11 resize-none"
              input={inputHeight}
              onChange={handleHeightChange}
              placeholder="Enter height"
            />
          </div>

          <div className="container flex flex-col mx-auto h-[100px]">
            <label htmlFor="weight" className="text-md font-semibold mb-2">
              Weight
            </label>
            <textarea
              id="age"
              className="border border-primary rounded-lg p-2 w-[150px] h-11 resize-none"
              input={inputWeight}
              onChange={handleWeightChange}
              placeholder="Enter weight"
            />
          </div>

          <div className="container flex flex-col mx-auto h-[100px]">
            <label
              htmlFor="exerciseFreq"
              className="text-md font-semibold mb-2"
            >
              Exercise Frequency
            </label>
            <textarea
              id="exerciseFreq"
              className="border border-primary rounded-lg p-2 w-[250px] h-11 resize-none"
              input={inputExerciseFreq}
              onChange={handleExerciseFreqChange}
              placeholder="Enter exercise frequency"
            />
          </div>
        </div>

        <div
          className="animate-in flex flex-col w-full xl:flex-row mt-2"
          style={{ "--index": 3 } as React.CSSProperties}
        >
          <div className="flex flex-col w-full h-[300px] container">
            <label
              htmlFor="recommendations"
              className="text-lg font-semibold mb-2"
            >
              Clothing Recommendations
            </label>
            <textarea
              id="recommendations"
              className="border border-primary rounded-lg p-2 h-full resize-none"
              value={outputText}
              placeholder="Output will be generated here..."
              readOnly
            />
            <button
              className="mt-4 bg-secondary hover:bg-tertiary font-bold py-2 px-4 border border-primary rounded"
              onClick={handleGenerateOutput}
            >
              Generate Output
            </button>
          </div>
        </div>

        
      </main>
    </div>
  );
}

function calculateEstimatedTime(routes: google.maps.DirectionsRoute[], departDateTime: string) {

  var chosenDate = Date.parse(departDateTime)
  var estimatedTimes = new Map<string, Date>()

  var legs = routes[0].legs
  var currentTime = chosenDate
  for(let i = 0; i < legs.length; i++) {
    if (legs[i].duration != null) {
      var endLocation = legs[i].end_address
      var mins = legs[i].duration?.value
      if (mins != undefined) {
        currentTime = currentTime + ( mins * 1000 )
        estimatedTimes.set(endLocation, new Date(currentTime))
      }
    }
  }

  return estimatedTimes;
}




function toOkta(val: number) {
  if (val === 100) {
    return 8;
  }
  return Math.min(Math.floor(val / 12.5), 7);
}

//const moment = require('moment');
function extracCurrentWeatherData(realTimeData:any, forecastData:any) {
  const sunrise = forecastData.forecast.forecastday[0].astro.sunrise;
  const sunset = forecastData.forecast.forecastday[0].astro.sunset;

  const sunriseTime = moment(sunrise, 'h:mm A');
  const sunsetTime = moment(sunset, 'h:mm A');

  const duration = parseFloat(((sunsetTime - sunriseTime) / 3600000).toFixed(1));

  const weatherData = {
    mintemp_c: [forecastData.forecast.forecastday[0].day.mintemp_c],
    maxtemp_c: [forecastData.forecast.forecastday[0].day.maxtemp_c],
    precip_mm: [realTimeData.current.precip_mm],
    sunshine: [duration],
    gust_kph: [realTimeData.current.gust_kph],
    daily_will_it_rain: [forecastData.forecast.forecastday[0].day.daily_will_it_rain],
    tom_will_it_rain: [forecastData.forecast.forecastday[1].day.daily_will_it_rain],
    wind_kph: [realTimeData.current.wind_kph],
    humidity: [realTimeData.current.humidity],
    pressure_mb: [realTimeData.current.pressure_mb],
    cloud: [toOkta(realTimeData.current.cloud)], 
    temp_c: [realTimeData.current.temp_c],
  };

  const dfCurrent = new DataFrame(weatherData);

  return dfCurrent;
}

//const response = await runInference(inputFeatures)
//const weatherinfo = await fetchForecastWeather()

//const forecastweather = await fetchWeatherInfo()


function createLatLngList(routes: google.maps.DirectionsRoute[]) {

  var legs = routes[0].legs
  var startLatLngPair;
  var stopLatLngPair;
  var endLatLngPair;

  for (let i = 0; i < legs.length; i++) {
    if (i == 0) {
      var startLocLat = legs[i].start_location.lat(); 
      var startLocLng = legs[i].start_location.lng();
      var stopLocLat = legs[i].end_location.lat();
      var stopLocLng = legs[i].end_location.lng();
    
      startLatLngPair = [startLocLat, startLocLng];
      stopLatLngPair = [stopLocLat, stopLocLng];
    } else {
      var endLocLat = legs[i].end_location.lat();
      var endLocLng = legs[i].end_location.lng();
      endLatLngPair = [endLocLat, endLocLng];
    }
  }
  var allLatLng = [startLatLngPair, stopLatLngPair, endLatLngPair].filter(Boolean);
  return allLatLng;
}


