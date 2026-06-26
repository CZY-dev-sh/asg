// React Theme — extracted from https://www.apple.com/
// Compatible with: Chakra UI, Stitches, Vanilla Extract, or any CSS-in-JS

/**
 * TypeScript type definition for this theme:
 *
 * interface Theme {
 *   colors: {
    primary: string;
    secondary: string;
    accent: string;
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
    '12': string;
    '14': string;
    '17': string;
    '21': string;
    '24': string;
    '28': string;
    '34': string;
    '40': string;
    '44': string;
    '56': string;
    '25.5': string;
    '13.3333': string;
 *   };
 *   space: {
    '0': string;
    '4': string;
    '24': string;
    '26': string;
    '30': string;
    '32': string;
    '34': string;
    '37': string;
    '40': string;
    '44': string;
    '48': string;
    '53': string;
    '56': string;
    '59': string;
    '80': string;
    '84': string;
 *   };
 *   radii: {
    sm: string;
    md: string;
    full: string;
 *   };
 *   shadows: {
    xl: string;
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
    "primary": "#2997ff",
    "secondary": "#f5f5f7",
    "accent": "#f5f5f7",
    "background": "#ffffff",
    "foreground": "#000000",
    "neutral50": "#1d1d1f",
    "neutral100": "#000000",
    "neutral200": "#333336",
    "neutral300": "#6e6e73",
    "neutral400": "#ffffff",
    "neutral500": "#d2d2d7"
  },
  "fonts": {
    "body": "'Arial', sans-serif"
  },
  "fontSizes": {
    "12": "12px",
    "14": "14px",
    "17": "17px",
    "21": "21px",
    "24": "24px",
    "28": "28px",
    "34": "34px",
    "40": "40px",
    "44": "44px",
    "56": "56px",
    "25.5": "25.5px",
    "13.3333": "13.3333px"
  },
  "space": {
    "0": "0px",
    "4": "4px",
    "24": "24px",
    "26": "26px",
    "30": "30px",
    "32": "32px",
    "34": "34px",
    "37": "37px",
    "40": "40px",
    "44": "44px",
    "48": "48px",
    "53": "53px",
    "56": "56px",
    "59": "59px",
    "80": "80px",
    "84": "84px"
  },
  "radii": {
    "sm": "5px",
    "md": "8px",
    "full": "999px"
  },
  "shadows": {
    "xl": "rgba(0, 0, 0, 0.22) 3px 5px 30px 0px"
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
      "main": "#2997ff",
      "light": "hsl(209, 100%, 73%)",
      "dark": "hsl(209, 100%, 43%)"
    },
    "secondary": {
      "main": "#f5f5f7",
      "light": "hsl(240, 11%, 95%)",
      "dark": "hsl(240, 11%, 81%)"
    },
    "background": {
      "default": "#ffffff",
      "paper": "#fafafc"
    },
    "text": {
      "primary": "#000000",
      "secondary": "#1d1d1f"
    }
  },
  "typography": {
    "h1": {
      "fontSize": "34px",
      "fontWeight": "600",
      "lineHeight": "50px"
    },
    "h2": {
      "fontSize": "25.5px",
      "fontWeight": "600",
      "lineHeight": "37.5px"
    }
  },
  "shape": {
    "borderRadius": 8
  },
  "shadows": [
    "rgba(0, 0, 0, 0.22) 3px 5px 30px 0px"
  ]
};

export default theme;
