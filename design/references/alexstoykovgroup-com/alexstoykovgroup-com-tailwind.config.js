/** @type {import('tailwindcss').Config} */
export default {
  theme: {
    extend: {
    colors: {
        primary: {
            '50': 'hsl(NaN, NaN%, 97%)',
            '100': 'hsl(NaN, NaN%, 94%)',
            '200': 'hsl(NaN, NaN%, 86%)',
            '300': 'hsl(NaN, NaN%, 76%)',
            '400': 'hsl(NaN, NaN%, 64%)',
            '500': 'hsl(NaN, NaN%, 50%)',
            '600': 'hsl(NaN, NaN%, 40%)',
            '700': 'hsl(NaN, NaN%, 32%)',
            '800': 'hsl(NaN, NaN%, 24%)',
            '900': 'hsl(NaN, NaN%, 16%)',
            '950': 'hsl(NaN, NaN%, 10%)',
            DEFAULT: '#4a5464'
        },
        secondary: {
            '50': 'hsl(NaN, NaN%, 97%)',
            '100': 'hsl(NaN, NaN%, 94%)',
            '200': 'hsl(NaN, NaN%, 86%)',
            '300': 'hsl(NaN, NaN%, 76%)',
            '400': 'hsl(NaN, NaN%, 64%)',
            '500': 'hsl(NaN, NaN%, 50%)',
            '600': 'hsl(NaN, NaN%, 40%)',
            '700': 'hsl(NaN, NaN%, 32%)',
            '800': 'hsl(NaN, NaN%, 24%)',
            '900': 'hsl(NaN, NaN%, 16%)',
            '950': 'hsl(NaN, NaN%, 10%)',
            DEFAULT: '#010d15'
        },
        'neutral-50': '#121212',
        'neutral-100': '#dcdcd8',
        'neutral-200': '#000000',
        'neutral-300': '#fafafa',
        'neutral-400': '#e7e7e7',
        'neutral-500': '#262626',
        background: '#fafafa',
        foreground: '#000000'
    },
    fontFamily: {
        body: [
            'sans-serif',
            'sans-serif'
        ],
        font3: [
            'Poppins',
            'sans-serif'
        ]
    },
    fontSize: {
        '10': [
            '10px',
            {
                lineHeight: '10px'
            }
        ],
        '12': [
            '12px',
            {
                lineHeight: '20.4px'
            }
        ],
        '15': [
            '15px',
            {
                lineHeight: 'normal'
            }
        ],
        '18': [
            '18px',
            {
                lineHeight: '18px'
            }
        ],
        '48': [
            '48px',
            {
                lineHeight: '48px',
                letterSpacing: '1.8px'
            }
        ],
        '118': [
            '118px',
            {
                lineHeight: '27px'
            }
        ],
        '120': [
            '120px',
            {
                lineHeight: '27px'
            }
        ],
        '115.9': [
            '115.9px',
            {
                lineHeight: '27px'
            }
        ],
        '42.648': [
            '42.648px',
            {
                lineHeight: '55.4083px'
            }
        ],
        '33.432': [
            '33.432px',
            {
                lineHeight: '44.5582px'
            }
        ],
        '30.36': [
            '30.36px',
            {
                lineHeight: 'normal'
            }
        ],
        '24.216': [
            '24.216px',
            {
                lineHeight: '31.4614px'
            }
        ],
        '21.144': [
            '21.144px',
            {
                lineHeight: '38.0592px'
            }
        ],
        '18.072': [
            '18.072px',
            {
                lineHeight: '32.5296px',
                letterSpacing: '1.8072px'
            }
        ],
        '13.464': [
            '13.464px',
            {
                lineHeight: 'normal',
                letterSpacing: '0.26928px'
            }
        ]
    },
    spacing: {
        '0': '1px',
        '1': '23px',
        '2': '26px',
        '3': '36px',
        '4': '51px',
        '5': '64px',
        '6': '77px',
        '7': '120px',
        '8': '337px',
        '9': '368px',
        '10': '397px'
    },
    borderRadius: {
        sm: '4px',
        md: '8px',
        lg: '16px',
        full: '300px'
    },
    boxShadow: {
        xs: 'rgba(0, 0, 0, 0.15) 0px 1px 2px 0px',
        md: 'rgba(0, 0, 0, 0.15) 0px 4px 12px 0px'
    },
    screens: {
        sm: '576px',
        md: '769px',
        lg: '1025px',
        xl: '1281px'
    },
    transitionDuration: {
        '1': '0.001s',
        '100': '0.1s',
        '140': '0.14s',
        '200': '0.2s',
        '250': '0.25s',
        '300': '0.3s',
        '350': '0.35s',
        '400': '0.4s',
        '500': '0.5s',
        '600': '0.6s',
        '1000': '1s',
        '1500': '1.5s',
        '8.26446': '0.00826446s',
        '16.5289': '0.0165289s',
        '24.793400000000002': '0.0247934s',
        '33.057900000000004': '0.0330579s',
        '41.3223': '0.0413223s',
        '49.586800000000004': '0.0495868s',
        '57.8512': '0.0578512s',
        '66.1157': '0.0661157s',
        '74.38019999999999': '0.0743802s',
        '82.6446': '0.0826446s',
        '90.90910000000001': '0.0909091s',
        '99.17360000000001': '0.0991736s',
        '107.438': '0.107438s',
        '115.702': '0.115702s',
        '123.967': '0.123967s',
        '132.231': '0.132231s',
        '140.496': '0.140496s'
    },
    transitionTimingFunction: {
        default: 'ease',
        custom: 'cubic-bezier(0.2, 0.6, 0.3, 1)',
        linear: 'linear'
    },
    container: {
        center: true,
        padding: '0px'
    },
    maxWidth: {
        container: '100%'
    }
},
  },
};
