package com.gridguardian.simulation;

import java.util.List;

public class BasicStrategy implements EnergyManagementStrategy {

    private final BuildingEnergyAllocator allocator =
            new BuildingEnergyAllocator();

    @Override
    public HourlyResult execute(
            StrategyContext context,
            Battery battery
    ) {

        HourlyInput input = context.input();

        double demand = input.demandKwh();
        double solar = input.solarGenerationKwh();

        double solarToLoad =
                Math.min(demand, solar);

        double remainingDemand =
                demand - solarToLoad;

        double remainingSolar =
                solar - solarToLoad;

        double solarToBattery = 0.0;

        if (input.batteryAvailable()) {
            solarToBattery =
                    battery.charge(remainingSolar);
        }

        double curtailedSolar =
                remainingSolar - solarToBattery;

        double batteryToLoad = 0.0;

        if (input.batteryAvailable()) {
            batteryToLoad =
                    battery.discharge(remainingDemand);

            remainingDemand -=
                    batteryToLoad;
        }

        double gridToLoad = 0.0;

        if (input.gridAvailable()) {
            gridToLoad =
                    remainingDemand;

            remainingDemand = 0.0;
        }

        double unservedEnergy =
                remainingDemand;

        double cost =
                gridToLoad
                        * input.gridPricePerKwh();

        double servedEnergy =
                demand - unservedEnergy;

        List<BuildingEnergyResult> buildingResults =
                allocator.allocateProportionally(
                        input.buildingLoads(),
                        servedEnergy
                );

        return new HourlyResult(
                input.hour(),
                input.demandKwh(),
                input.solarGenerationKwh(),
                solarToLoad,
                solarToBattery,
                batteryToLoad,
                gridToLoad,
                unservedEnergy,
                curtailedSolar,
                battery.getSocKwh(),
                cost,
                buildingResults
        );
    }
}