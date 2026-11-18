package com.gridguardian.simulation;

import java.io.IOException;
import java.util.List;
import java.util.Set;

public class CsvSimulationInputProvider implements SimulationInputProvider {

    private final Set<BuildingType> criticalBuildings;
    private final CsvHourlyProfileLoader profileLoader;
    private final HourlyInputFactory inputFactory;

    public CsvSimulationInputProvider(
            Set<BuildingType> criticalBuildings
    ) {

        if (criticalBuildings == null) {
            throw new IllegalArgumentException(
                    "Critical buildings cannot be null."
            );
        }

        this.criticalBuildings =
                Set.copyOf(criticalBuildings);

        this.profileLoader =
                new CsvHourlyProfileLoader();

        this.inputFactory =
                new HourlyInputFactory();
    }

    @Override
    public List<HourlyInput> loadInputs() {

        try {

            List<Building> buildings =
                    List.of(
                            createBuilding(
                                    BuildingType.DORMITORY,
                                    "data/dev/dormitory.csv"
                            ),
                            createBuilding(
                                    BuildingType.LIBRARY,
                                    "data/dev/library.csv"
                            ),
                            createBuilding(
                                    BuildingType.LABORATORY,
                                    "data/dev/laboratory.csv"
                            ),
                            createBuilding(
                                    BuildingType.CAFETERIA,
                                    "data/dev/cafeteria.csv"
                            )
                    );

            HourlyProfile solarProfile =
                    profileLoader.loadFromResource(
                            "data/solar.csv"
                    );

            HourlyProfile priceProfile =
                    profileLoader.loadFromResource(
                            "data/price.csv"
                    );

            return inputFactory.create(
                    buildings,
                    solarProfile,
                    priceProfile
            );

        } catch (IOException exception) {

            throw new IllegalStateException(
                    "Failed to load simulation input data.",
                    exception
            );
        }
    }

    private Building createBuilding(
            BuildingType type,
            String resourcePath
    ) throws IOException {

        return new Building(
                type,
                criticalBuildings.contains(type),
                profileLoader.loadFromResource(
                        resourcePath
                )
        );
    }
}