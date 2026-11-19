package com.gridguardian.simulation;

import java.util.List;

public class CustomStrategy implements EnergyManagementStrategy {

    private final CustomStrategyConfig config;
    private final BuildingEnergyAllocator allocator =
            new BuildingEnergyAllocator();

    public CustomStrategy() {
        this(CustomStrategyConfig.defaultConfig());
    }

    public CustomStrategy(
            CustomStrategyConfig config
    ) {

        if (config == null) {
            throw new IllegalArgumentException(
                    "Custom strategy config cannot be null."
            );
        }

        this.config = config;
    }

    @Override
    public HourlyResult execute(
            StrategyContext context,
            Battery battery
    ) {

        HourlyInput input =
                context.input();

        double demand =
                input.demandKwh();

        double solar =
                input.solarGenerationKwh();

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

            if (!input.gridAvailable()) {

                batteryToLoad =
                        battery.discharge(
                                remainingDemand
                        );

            } else {

                boolean outageIsNear =
                        context.hasGridOutageStartingWithin(
                                config.outagePreparationHours()
                        );

                if (!outageIsNear
                        && config.useBatteryForHighPrice()
                        && input.gridPricePerKwh()
                        >= config.highPriceThreshold()) {

                    double reserveKwh =
                            battery.getCapacityKwh()
                                    * config.minimumReservePercent()
                                    / 100.0;

                    double availableAboveReserve =
                            Math.max(
                                    0.0,
                                    battery.getSocKwh()
                                            - reserveKwh
                            );

                    batteryToLoad =
                            battery.discharge(
                                    Math.min(
                                            remainingDemand,
                                            availableAboveReserve
                                    )
                            );
                }
            }

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

        List<BuildingEnergyResult> buildingResults;

        if (!input.gridAvailable()
                && config.prioritizeCriticalBuildings()) {

            buildingResults =
                    allocator.allocateCriticalFirst(
                            input.buildingLoads(),
                            servedEnergy
                    );

        } else {

            buildingResults =
                    allocator.allocateProportionally(
                            input.buildingLoads(),
                            servedEnergy
                    );
        }

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