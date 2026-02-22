import {
  Server,
  Database,
  Monitor,
  Shield,
  Scale,
  MessageSquare,
  Zap,
  Cloud,
  type LucideIcon,
} from 'lucide-react';
import type { NodeType } from './types';

export interface PaletteItem {
  type: NodeType;
  label: string;
  description: string;
  icon: LucideIcon;
  color: string;
  bgColor: string;
  borderColor: string;
}

export const PALETTE_ITEMS: PaletteItem[] = [
  {
    type: 'service',
    label: 'Service',
    description: 'Microservice or backend',
    icon: Server,
    color: 'text-blue-700',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-300',
  },
  {
    type: 'database',
    label: 'Database',
    description: 'SQL, NoSQL, data store',
    icon: Database,
    color: 'text-green-700',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-300',
  },
  {
    type: 'client',
    label: 'Client',
    description: 'Browser, mobile, CLI',
    icon: Monitor,
    color: 'text-purple-700',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-300',
  },
  {
    type: 'gateway',
    label: 'API Gateway',
    description: 'Entry point / router',
    icon: Shield,
    color: 'text-orange-700',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-300',
  },
  {
    type: 'loadbalancer',
    label: 'Load Balancer',
    description: 'Traffic distribution',
    icon: Scale,
    color: 'text-red-700',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-300',
  },
  {
    type: 'queue',
    label: 'Message Queue',
    description: 'Kafka, RabbitMQ, SQS',
    icon: MessageSquare,
    color: 'text-yellow-700',
    bgColor: 'bg-yellow-50',
    borderColor: 'border-yellow-300',
  },
  {
    type: 'cache',
    label: 'Cache',
    description: 'Redis, Memcached, CDN',
    icon: Zap,
    color: 'text-cyan-700',
    bgColor: 'bg-cyan-50',
    borderColor: 'border-cyan-300',
  },
  {
    type: 'group',
    label: 'Cloud Group',
    description: 'AWS, GCP, Azure zone',
    icon: Cloud,
    color: 'text-slate-700',
    bgColor: 'bg-slate-50',
    borderColor: 'border-slate-300',
  },
];
