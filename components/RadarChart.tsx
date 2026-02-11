
import React from 'react';

interface Props {
  data: { [key: string]: number }; // Key: Dimension Name, Value: Score (1-6)
  size?: number;
  color?: string;
}

const RadarChart: React.FC<Props> = ({ data, size = 200, color = '#007AFF' }) => {
  const dimensions = Object.keys(data);
  const count = dimensions.length;
  const radius = size / 2;
  const center = size / 2;
  const scale = radius - 20; // Padding

  // Helper to calculate points
  const getPoint = (value: number, index: number, max: number = 6) => {
    const angle = (Math.PI * 2 * index) / count - Math.PI / 2;
    const r = (value / max) * scale;
    const x = center + r * Math.cos(angle);
    const y = center + r * Math.sin(angle);
    return [x, y];
  };

  // Generate grid points (Levels 1 to 6)
  const gridLevels = [2, 4, 6];
  
  // Generate data path
  const dataPoints = dimensions.map((key, i) => getPoint(data[key], i)).map(p => p.join(',')).join(' ');

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="overflow-visible">
        {/* Grid Lines */}
        {gridLevels.map(level => (
          <polygon
            key={level}
            points={dimensions.map((_, i) => getPoint(level, i).join(',')).join(' ')}
            fill="none"
            stroke="#E5E7EB"
            strokeWidth="1"
            strokeDasharray="4 4"
          />
        ))}
        
        {/* Axis Lines */}
        {dimensions.map((_, i) => {
           const [x, y] = getPoint(6, i);
           return <line key={i} x1={center} y1={center} x2={x} y2={y} stroke="#E5E7EB" strokeWidth="1" />;
        })}

        {/* Data Polygon */}
        <polygon
          points={dataPoints}
          fill={color}
          fillOpacity="0.2"
          stroke={color}
          strokeWidth="2"
        />

        {/* Data Points (Dots) */}
        {dimensions.map((key, i) => {
          const [x, y] = getPoint(data[key], i);
          return (
            <circle key={i} cx={x} cy={y} r="3" fill="white" stroke={color} strokeWidth="2" />
          );
        })}

        {/* Labels */}
        {dimensions.map((key, i) => {
           // Push labels out a bit further than the max radius
           const angle = (Math.PI * 2 * i) / count - Math.PI / 2;
           const labelRadius = scale + 15; 
           const x = center + labelRadius * Math.cos(angle);
           const y = center + labelRadius * Math.sin(angle);
           
           // Simple alignment adjustment based on position
           let anchor: "middle" | "end" | "start" = 'middle';
           if (x < center - 10) anchor = 'end';
           if (x > center + 10) anchor = 'start';
           
           return (
             <text 
               key={i} 
               x={x} 
               y={y} 
               fontSize="9" 
               fontWeight="bold" 
               fill="#6B7280" 
               textAnchor={anchor} 
               dominantBaseline="middle"
               className="uppercase"
             >
               {key.substring(0, 4)}
             </text>
           );
        })}
      </svg>
    </div>
  );
};

export default RadarChart;
