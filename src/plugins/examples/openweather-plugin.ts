import { MCPPlugin, PluginContext, Tool, Resource } from "../../types/plugin";

export interface WeatherData {
  location: string;
  temperature: number;
  description: string;
  humidity: number;
  windSpeed: number;
  pressure: number;
}

export class OpenWeatherPlugin implements MCPPlugin {
  public readonly name = "openweather";
  public readonly version = "1.0.0";
  public readonly description =
    "OpenWeatherMap API integration for weather data";
  public readonly dependencies: string[] = [];

  private context: PluginContext | null = null;
  private apiKey: string | null = null;

  async initialize(context: PluginContext): Promise<void> {
    this.context = context;

    // Get API key from secure storage
    this.apiKey = await context.getCredential("api_key");

    if (!this.apiKey) {
      throw new Error(
        "OpenWeatherMap API key is required. Please set it using the credential management API."
      );
    }

    context.logger.info("OpenWeatherMap plugin initialized successfully");
  }

  getTools(): Tool[] {
    return [
      {
        name: "get_weather",
        description: "Get current weather information for a specific location",
        inputSchema: {
          type: "object",
          properties: {
            location: {
              type: "string",
              description:
                "City name, state code and country code divided by comma (e.g., 'London,UK' or 'New York,NY,US')",
            },
            units: {
              type: "string",
              enum: ["metric", "imperial", "kelvin"],
              description:
                "Temperature units (metric=Celsius, imperial=Fahrenheit, kelvin=Kelvin)",
              default: "metric",
            },
          },
          required: ["location"],
        },
      },
      {
        name: "get_forecast",
        description: "Get 5-day weather forecast for a specific location",
        inputSchema: {
          type: "object",
          properties: {
            location: {
              type: "string",
              description:
                "City name, state code and country code divided by comma",
            },
            units: {
              type: "string",
              enum: ["metric", "imperial", "kelvin"],
              description: "Temperature units",
              default: "metric",
            },
          },
          required: ["location"],
        },
      },
    ];
  }

  getResources(): Resource[] {
    return [
      {
        uri: "weather://current",
        name: "Current Weather",
        description: "Current weather conditions for various locations",
        mimeType: "application/json",
      },
      {
        uri: "weather://forecast",
        name: "Weather Forecast",
        description: "5-day weather forecast for various locations",
        mimeType: "application/json",
      },
    ];
  }

  async executeTool(name: string, args: any): Promise<any> {
    if (!this.context || !this.apiKey) {
      throw new Error("Plugin not properly initialized");
    }

    switch (name) {
      case "get_weather":
        return await this.getCurrentWeather(
          args.location,
          args.units || "metric"
        );

      case "get_forecast":
        return await this.getForecast(args.location, args.units || "metric");

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  }

  private async getCurrentWeather(
    location: string,
    units: string
  ): Promise<WeatherData> {
    const baseUrl = "http://api.openweathermap.org/data/2.5/weather";
    const url = `${baseUrl}?q=${encodeURIComponent(location)}&appid=${
      this.apiKey
    }&units=${units}`;

    try {
      const response = await fetch(url);

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error("Invalid API key");
        } else if (response.status === 404) {
          throw new Error(`Location not found: ${location}`);
        } else {
          throw new Error(
            `Weather API error: ${response.status} ${response.statusText}`
          );
        }
      }

      const data = await response.json();

      return {
        location: `${data.name}, ${data.sys.country}`,
        temperature: Math.round(data.main.temp),
        description: data.weather[0].description,
        humidity: data.main.humidity,
        windSpeed: data.wind.speed,
        pressure: data.main.pressure,
      };
    } catch (error) {
      this.context?.logger.error("Failed to fetch weather data:", error);
      throw error;
    }
  }

  private async getForecast(location: string, units: string): Promise<any> {
    const baseUrl = "http://api.openweathermap.org/data/2.5/forecast";
    const url = `${baseUrl}?q=${encodeURIComponent(location)}&appid=${
      this.apiKey
    }&units=${units}`;

    try {
      const response = await fetch(url);

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error("Invalid API key");
        } else if (response.status === 404) {
          throw new Error(`Location not found: ${location}`);
        } else {
          throw new Error(
            `Weather API error: ${response.status} ${response.statusText}`
          );
        }
      }

      const data = await response.json();

      // Process forecast data to return a more structured format
      const forecast = data.list.map((item: any) => ({
        datetime: new Date(item.dt * 1000).toISOString(),
        temperature: Math.round(item.main.temp),
        description: item.weather[0].description,
        humidity: item.main.humidity,
        windSpeed: item.wind.speed,
        pressure: item.main.pressure,
      }));

      return {
        location: `${data.city.name}, ${data.city.country}`,
        forecast,
      };
    } catch (error) {
      this.context?.logger.error("Failed to fetch forecast data:", error);
      throw error;
    }
  }

  async cleanup(): Promise<void> {
    this.context?.logger.info("OpenWeatherMap plugin cleaned up");
    this.context = null;
    this.apiKey = null;
  }
}
