import React from 'react';

interface BalloonIconProps {
  className?: string;
  variant?: 'keep' | 'pop';
  size?: number;
}

export const BalloonIcon: React.FC<BalloonIconProps> = ({ className = 'w-5 h-5', variant = 'keep', size = 20 }) => {
  if (variant === 'pop') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
      >
        {/* Popping Balloon SVG */}
        <path
          d="M12 2C8.5 2 5.5 4.5 5 8C4.5 11.5 6.5 14.5 9 16C9.5 16.3 10 17.5 10 18.5H14C14 17.5 14.5 16.3 15 16C17.5 14.5 19.5 11.5 19 8C18.5 4.5 15.5 2 12 2Z"
          fill="currentColor"
          fillOpacity="0.25"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Pop Sparks */}
        <path d="M4 4L2 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M20 4L22 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M2 12H4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M20 12H22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        {/* Balloon String Knot */}
        <path d="M12 18.5V22" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    );
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Floating Keep Balloon SVG */}
      <path
        d="M12 2C7.58172 2 4 5.58172 4 10C4 14.4183 7.58172 17.5 10.5 18.5C11 18.6667 11.5 19.5 11.5 20H12.5C12.5 19.5 13 18.6667 13.5 18.5C16.4183 17.5 20 14.4183 20 10C20 5.58172 16.4183 2 12 2Z"
        fill="currentColor"
        fillOpacity="0.85"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Shine highlight */}
      <path
        d="M9 5.5C10 4.8 11.5 4.5 13 4.8"
        stroke="white"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeOpacity="0.7"
      />
      {/* Balloon Thread */}
      <path
        d="M12 20C12 21 11 21.5 12 22.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
};
