import { CardView } from "./CardView";
import { CategoryBreakdown } from "./CategoryBreakdown";
import { InvestmentReturns } from "./InvestmentReturns";
import { Last30DaysCard } from "./Last30DaysCard";
import { NetWorthChart } from "./NetWorthChart";
import { TrendChart } from "./TrendChart";

/** Every number comes from the API; each panel loads, fails and renders its empty state alone. */
export function DashboardPage() {
  return (
    <div className="mx-auto max-w-[1500px] space-y-6">
      <header className="border-b pb-6">
        <h1 className="text-3xl font-semibold">Dashboard</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Despesas, tendência, categorias, cartão e patrimônio em um só lugar.
        </p>
      </header>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Last30DaysCard />
        <NetWorthChart />
      </div>
      <TrendChart />
      <CategoryBreakdown />
      <CardView />
      <InvestmentReturns />
    </div>
  );
}
