// React Theme — extracted from https://www.alexstoykovgroup.com
// Compatible with: Chakra UI, Stitches, Vanilla Extract, or any CSS-in-JS

/**
 * TypeScript type definition for this theme:
 *
 * interface Theme {
 *   colors: {
    primary: string;
    secondary: string;
    background: string;
    foreground: string;
    neutral50: string;
    neutral100: string;
    neutral200: string;
    neutral300: string;
    neutral400: string;
    neutral500: string;
 *   };
 *   fonts: {
    body: string;
 *   };
 *   fontSizes: {
    '15': string;
    '18': string;
    '48': string;
    '118': string;
    '120': string;
    '115.9': string;
    '42.648': string;
    '33.432': string;
    '30.36': string;
    '24.216': string;
    '21.144': string;
    '18.072': string;
 *   };
 *   space: {
    '1': string;
    '23': string;
    '26': string;
    '36': string;
    '51': string;
    '64': string;
    '77': string;
    '120': string;
    '337': string;
    '368': string;
    '397': string;
 *   };
 *   radii: {
    sm: string;
    md: string;
    lg: string;
    full: string;
 *   };
 *   shadows: {
    xs: string;
    md: string;
 *   };
 *   states: {
 *     hover: { opacity: number };
 *     focus: { opacity: number };
 *     active: { opacity: number };
 *     disabled: { opacity: number };
 *   };
 * }
 */

export const theme = {
  "colors": {
    "primary": "#4a5464",
    "secondary": "#010d15",
    "background": "#fafafa",
    "foreground": "#000000",
    "neutral50": "#121212",
    "neutral100": "#dcdcd8",
    "neutral200": "#000000",
    "neutral300": "#fafafa",
    "neutral400": "#e7e7e7",
    "neutral500": "#262626"
  },
  "fonts": {
    "body": "'Poppins', sans-serif"
  },
  "fontSizes": {
    "15": "15px",
    "18": "18px",
    "48": "48px",
    "118": "118px",
    "120": "120px",
    "115.9": "115.9px",
    "42.648": "42.648px",
    "33.432": "33.432px",
    "30.36": "30.36px",
    "24.216": "24.216px",
    "21.144": "21.144px",
    "18.072": "18.072px"
  },
  "space": {
    "1": "1px",
    "23": "23px",
    "26": "26px",
    "36": "36px",
    "51": "51px",
    "64": "64px",
    "77": "77px",
    "120": "120px",
    "337": "337px",
    "368": "368px",
    "397": "397px"
  },
  "radii": {
    "sm": "4px",
    "md": "8px",
    "lg": "16px",
    "full": "300px"
  },
  "shadows": {
    "xs": "rgba(0, 0, 0, 0.15) 0px 1px 2px 0px",
    "md": "rgba(0, 0, 0, 0.15) 0px 4px 12px 0px"
  },
  "states": {
    "hover": {
      "opacity": 0.08
    },
    "focus": {
      "opacity": 0.12
    },
    "active": {
      "opacity": 0.16
    },
    "disabled": {
      "opacity": 0.38
    }
  }
};

// MUI v5 theme
export const muiTheme = {
  "palette": {
    "primary": {
      "main": "#4a5464",
      "light": "hsl(217, 15%, 49%)",
      "dark": "hsl(217, 15%, 19%)"
    },
    "secondary": {
      "main": "#010d15",
      "light": "hsl(204, 91%, 19%)",
      "dark": "hsl(204, 91%, 10%)"
    },
    "background": {
      "default": "#fafafa",
      "paper": "#ffffff"
    },
    "text": {
      "primary": "#000000",
      "secondary": "#121212"
    }
  },
  "typography": {
    "fontFamily": "'satoshi-ymnzpr', sans-serif",
    "h1": {
      "fontSize": "33.432px",
      "fontWeight": "500",
      "lineHeight": "44.5582px"
    }
  },
  "shape": {
    "borderRadius": 8
  },
  "shadows": [
    "rgba(0, 0, 0, 0.15) 0px 1px 2px 0px",
    "rgba(0, 0, 0, 0.2) 0px 0px 10px 0px",
    "rgba(0, 0, 0, 0.15) 0px 4px 12px 0px"
  ]
};

export default theme;
