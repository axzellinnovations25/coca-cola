import CreateOrder from '../representative/CreateOrder';

interface AdminSalesEntryProps {
  onOrderPlaced: () => void;
}

export default function AdminSalesEntry({ onOrderPlaced }: AdminSalesEntryProps) {
  return <CreateOrder adminMode onOrderPlaced={onOrderPlaced} />;
}
