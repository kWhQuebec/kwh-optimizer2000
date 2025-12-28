import { useMemo } from 'react';
import { 
  buildCashflowModel, 
  CashflowInputs, 
  CashflowModel, 
  DEFAULT_CASHFLOW_INPUTS 
} from '@shared/finance/cashflowEngine';

export interface UseCashflowModelProps {
  systemSizeKW: number;
  annualProductionKWh?: number;
  kwhCostPerWatt?: number;
  gridRateY1?: number;
  kwhInflation?: number;
  trcInflation?: number;
  degradation?: number;
  ppaTerm?: number;
  ppaDiscount?: number;
  trcProjectCost?: number;
}

export function useCashflowModel(props: UseCashflowModelProps): CashflowModel | null {
  return useMemo(() => {
    if (!props.systemSizeKW || props.systemSizeKW <= 0) {
      return null;
    }

    const inputs: CashflowInputs = {
      systemSizeKW: props.systemSizeKW,
      annualProductionKWh: props.annualProductionKWh || props.systemSizeKW * 1200,
      kwhCostPerWatt: props.kwhCostPerWatt || 2.15,
      hqIncentivePerKw: DEFAULT_CASHFLOW_INPUTS.hqIncentivePerKw!,
      itcRate: DEFAULT_CASHFLOW_INPUTS.itcRate!,
      gridRateY1: props.gridRateY1 || 0.13,
      kwhInflation: props.kwhInflation || DEFAULT_CASHFLOW_INPUTS.kwhInflation!,
      trcInflation: props.trcInflation || DEFAULT_CASHFLOW_INPUTS.trcInflation!,
      degradation: props.degradation || DEFAULT_CASHFLOW_INPUTS.degradation!,
      omRate: DEFAULT_CASHFLOW_INPUTS.omRate!,
      omEscalation: DEFAULT_CASHFLOW_INPUTS.omEscalation!,
      ccaRate: DEFAULT_CASHFLOW_INPUTS.ccaRate!,
      taxRate: DEFAULT_CASHFLOW_INPUTS.taxRate!,
      leaseTerm: DEFAULT_CASHFLOW_INPUTS.leaseTerm!,
      leasePremium: DEFAULT_CASHFLOW_INPUTS.leasePremium!,
      ppaTerm: props.ppaTerm || DEFAULT_CASHFLOW_INPUTS.ppaTerm!,
      ppaDiscount: props.ppaDiscount || DEFAULT_CASHFLOW_INPUTS.ppaDiscount!,
      ppaOmRate: DEFAULT_CASHFLOW_INPUTS.ppaOmRate!,
      trcProjectCost: props.trcProjectCost
    };

    return buildCashflowModel(inputs);
  }, [
    props.systemSizeKW,
    props.annualProductionKWh,
    props.kwhCostPerWatt,
    props.gridRateY1,
    props.kwhInflation,
    props.trcInflation,
    props.degradation,
    props.ppaTerm,
    props.ppaDiscount,
    props.trcProjectCost
  ]);
}
