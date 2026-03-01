import { useMemo } from 'react';
import { ResponsiveContainer, Sankey, Tooltip, Layer, Rectangle } from 'recharts';
import { formatCurrency } from '../lib/format.js';

const nodeColors = [
	'#0017C1', '#2563EB', '#3B82F6', '#60A5FA',
	'#E11D48', '#F97316', '#EAB308', '#22C55E',
	'#8B5CF6', '#EC4899', '#14B8A6', '#6366F1',
];

function SankeyNode({ x, y, width, height, index, payload }) {
	const color = nodeColors[index % nodeColors.length];
	return (
		<Layer key={`sankey-node-${index}`}>
			<Rectangle
				x={x}
				y={y}
				width={width}
				height={height}
				fill={color}
				fillOpacity={0.9}
				rx={3}
				ry={3}
			/>
			<text
				x={x + width + 8}
				y={y + height / 2}
				textAnchor="start"
				dominantBaseline="central"
				fontSize={12}
				fill="#1A1A1C"
				fontWeight={500}
			>
				{payload.name}
			</text>
		</Layer>
	);
}

function SankeyLink({ sourceX, targetX, sourceY, targetY, sourceControlX, targetControlX, linkWidth, index, payload }) {
	const sourceColor = nodeColors[(payload.source?.index ?? index) % nodeColors.length];
	const gradientId = `link-gradient-${index}`;
	const targetColor = nodeColors[(payload.target?.index ?? 0) % nodeColors.length];

	return (
		<Layer key={`sankey-link-${index}`}>
			<defs>
				<linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="0">
					<stop offset="0%" stopColor={sourceColor} stopOpacity={0.3} />
					<stop offset="100%" stopColor={targetColor} stopOpacity={0.15} />
				</linearGradient>
			</defs>
			<path
				d={`
					M${sourceX},${sourceY + linkWidth / 2}
					C${sourceControlX},${sourceY + linkWidth / 2}
					 ${targetControlX},${targetY + linkWidth / 2}
					 ${targetX},${targetY + linkWidth / 2}
					L${targetX},${targetY - linkWidth / 2}
					C${targetControlX},${targetY - linkWidth / 2}
					 ${sourceControlX},${sourceY - linkWidth / 2}
					 ${sourceX},${sourceY - linkWidth / 2}
					Z
				`}
				fill={`url(#${gradientId})`}
				stroke={sourceColor}
				strokeWidth={0.5}
				strokeOpacity={0.2}
			/>
		</Layer>
	);
}

function SankeyTooltipContent({ active, payload }) {
	if (!active || !payload?.[0]) return null;
	const { payload: data } = payload[0];

	if (data.source && data.target) {
		return (
			<div style={{
				background: '#fff',
				border: '1px solid #D9D9D9',
				borderRadius: '8px',
				padding: '8px 12px',
				fontSize: '0.8rem',
				boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
			}}>
				<p style={{ margin: '0 0 2px', fontWeight: 600 }}>
					{data.source.name} → {data.target.name}
				</p>
				<p style={{ margin: 0, color: '#626264' }}>{formatCurrency(data.value)}</p>
			</div>
		);
	}

	return (
		<div style={{
			background: '#fff',
			border: '1px solid #D9D9D9',
			borderRadius: '8px',
			padding: '8px 12px',
			fontSize: '0.8rem',
			boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
		}}>
			<p style={{ margin: 0, fontWeight: 600 }}>{data.name}</p>
			{data.value != null && <p style={{ margin: 0, color: '#626264' }}>{formatCurrency(data.value)}</p>}
		</div>
	);
}

export function SnakeGraph({ flows = [] }) {
	const sankeyData = useMemo(() => {
		if (!flows.length) return null;

		const nodeNames = new Set();
		for (const flow of flows) {
			nodeNames.add(flow.source);
			nodeNames.add(flow.target);
		}

		const nodeList = [...nodeNames];
		const nodeIndex = Object.fromEntries(nodeList.map((name, i) => [name, i]));
		const nodes = nodeList.map((name) => ({ name }));

		const links = flows.map((flow) => ({
			source: nodeIndex[flow.source],
			target: nodeIndex[flow.target],
			value: Math.round(flow.value / 100),
		})).filter((link) => link.value > 0 && link.source !== link.target);

		if (!links.length) return null;

		return { nodes, links };
	}, [flows]);

	if (!sankeyData) {
		return <p className="empty">まだフローデータがありません</p>;
	}

	return (
		<div className="snake-graph-wrapper">
			<ResponsiveContainer width="100%" height="100%">
				<Sankey
					data={sankeyData}
					nodeWidth={12}
					nodePadding={24}
					margin={{ top: 16, right: 120, bottom: 16, left: 16 }}
					link={<SankeyLink />}
					node={<SankeyNode />}
				>
					<Tooltip content={<SankeyTooltipContent />} />
				</Sankey>
			</ResponsiveContainer>
		</div>
	);
}
