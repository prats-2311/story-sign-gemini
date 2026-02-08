import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export const AnalyticsChart = ({ config }: { config: any }) => {
  if (!config || !config.data || !Array.isArray(config.data)) {
      console.warn("AnalyticsChart: Invalid or missing data array", config);
      return null;
  }

  return (
    <div className="h-64 w-full bg-gray-900/50 rounded-xl p-4 border border-gray-800 backdrop-blur-sm shadow-xl">
      <h4 className="text-xs font-bold text-cyber-cyan uppercase tracking-widest mb-4 flex items-center gap-2">
         <span className="w-2 h-2 bg-cyber-cyan rounded-full animate-pulse"/>
         {config.title}
      </h4>
      <div className="h-56 w-full min-h-[220px] min-w-[300px]">
        <ResponsiveContainer width="100%" height="100%">
            <LineChart data={config.data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
            <XAxis 
                dataKey="x" 
                stroke="#9CA3AF" 
                fontSize={10} 
                tickLine={false}
                axisLine={false}
                tickFormatter={(val) => `${val}s`}
            />
            <YAxis 
                stroke="#9CA3AF" 
                fontSize={10} 
                tickLine={false}
                axisLine={false}
            />
            <Tooltip 
                contentStyle={{ 
                    backgroundColor: '#111827', 
                    borderColor: '#06b6d4', 
                    borderRadius: '0.5rem',
                    fontSize: '12px'
                }}
                itemStyle={{ color: '#06b6d4' }}
                cursor={{ stroke: '#06b6d4', strokeWidth: 1, strokeDasharray: '5 5' }}
            />
            <Line 
                type="monotone" 
                dataKey="y" 
                stroke="#06b6d4" 
                strokeWidth={2} 
                dot={{ r: 3, fill: '#06b6d4', strokeWidth: 0 }} 
                activeDot={{ r: 6, fill: '#fff', stroke: '#06b6d4' }}
                animationDuration={1500}
            />
            </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
