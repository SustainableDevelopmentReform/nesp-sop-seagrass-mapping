# Appendix X: Case Study Application - Tayaritja (Furneaux Islands) Seagrass Mapping

## X.1 Project Overview

This case study demonstrates the application of the Seagrass Mapping SOP to map benthic habitats, with particular focus on seagrass meadows, in the Furneaux Group of Islands (Tayaritja) in north-eastern Tasmania. The project was conducted as part of the National Environmental Science Program (NESP) Marine and Coastal Hub's Project 3.6, which aimed to improve data on the distribution and ecological value of temperate subtidal seagrass in the region.

The Furneaux Group of Islands represents a significant ecological and cultural area, home to extensive seagrass meadows supporting various marine ecosystems. This mapping effort addresses a critical knowledge gap regarding the extent and distribution of coastal seagrass habitats in eastern Bass Strait, which was identified in the NESP Marine and Coastal Hub national wetlands scoping study.

## X.2 Study Area

The study area encompasses the western region of the Furneaux Group of Islands, with primary focus on the coastal waters surrounding Flinders Island. The mapped area extends from the coastline at high tide to a depth limit determined by the reliable detection of seagrass features using optical remote sensing techniques (approximately 18 meters in this case). This depth threshold was established through analysis of field data and satellite imagery capabilities in the study region.

![Study Area Map - Furneaux Group of Islands with the study area extent highlighted]

## X.3 Data Sources and Collection

### X.3.1 Field Data Collection

Field data collection followed the protocols outlined in Section 4 of the SOP, utilizing a statistically balanced sampling approach that maintained uniform sampling intensity while avoiding preference or exclusion of any areas.

The Benthic Observation Survey System (BOSS) was employed for collecting in-situ data, as described in Section 4.3 of the SOP. The BOSS system captures high-resolution panoramic imagery of the seafloor from multiple angles, providing detailed benthic habitat information. The CATAMI classification scheme was used for benthic feature labeling, with points annotated using the Squidle+ platform.

![BOSS Camera System - Image showing the deployment of the BOSS system with its four field view angles and example image output]

Field data was stratified to ensure representative subsets for calibration (70%) and validation (30%), maintaining similar depth distributions and benthic class representations in both subsets. The sampling design focused on capturing the full range of seagrass conditions, from dense beds to sparse coverage, as well as non-seagrass substrates for comparison.

### X.3.2 Environmental Data Sources

Following the guidance in Section 4.2 of the SOP, several ancillary data sources were integrated:

**Bathymetry and Derived Products:**
- High-resolution LiDAR bathymetry from surveys conducted for the Australian Hydrographic Office
- Lower-resolution LiDAR and sonar bathymetry to fill gaps in the primary dataset
- Derived products including slope and rugosity at multiple scales, as detailed in Section 4.2.1 of the SOP

**Wave Climate Data:**
- Wave hindcast model from Wavewatch III
- Metrics included average wave power, maximum wave power, and standard deviation
- Data was interpolated to create a uniform grid with appropriate spatial resolution for the study area

### X.3.3 Satellite Image Data

**Sentinel-2 Multispectral Imagery:**
- Processing aligned with Section 6.1 of the SOP, creating multi-temporal stacks between dates `yyyy-mm-dd` and `yyyy-mm-dd`
- Cloud masking using both Scene Classification Layer (SCL), cloud probability datasets and Google Cloud Score Plus
- Composite images were produced using percentile metrics (20th, 40th, 60th, 80th)

![Sentinel-2 Composite - True-color image showing the study site with cloud masking and atmospheric correction applied]

## X.4 Mapping Methodology

### X.4.1 Mapping Products

Three key mapping products were developed for this case study:

1. **Seagrass Occurrence Probability Map**: A continuous probability surface (0-100%) indicating the likelihood of seagrass presence at each pixel
2. **Seagrass Extent Map**: A binary presence/absence map derived by applying an optimized probability threshold to the occurrence probability map
3. **Seagrass Percent Cover Map**: A continuous map showing estimated seagrass percent cover within the mapped extent, providing finer detail on seagrass density variations
4. **Seagrass - Macroalgae - Sand fracitonal cover**: Method adapted to include Mcroalgae adn Sand to present a fracitonal cover style map ... ? REfer to terrestrial verisons?

These products offer complementary information: the probability map provides confidence information, the extent map offers a clear delineation of seagrass boundaries, and the percent cover map enables quantitative analysis of seagrass density patterns.

### X.4.2 Classification Approach

The mapping methodology followed Section 7 of the SOP, using Random Forest classification models for their robustness and effectiveness with complex environmental data. The models were developed with parameters optimized for the study area, including:
- Appropriate tree depth
- Optimized leaf population
- Balanced out-of-bag fraction
- A comprehensive set of predictor variables

The classification approach consisted of three main steps:

1. **Probabilistic Seagrass Classification**: Initial generation of a continuous probability surface indicating the likelihood of seagrass presence at each pixel

2. **Threshold Selection and Application**: Determination of an optimal probability threshold to convert the continuous probability map into a binary presence/absence map

3. **Cover Estimation within Seagrass Extent**: For areas identified as seagrass, a secondary model estimated percent cover, while also classifying non-seagrass areas as either macroalgae or sand

![Mapping Workflow Diagram - Flow diagram showing the three-step classification process]

### X.4.3 Code examples

The complete code implementation for this mapping process was implemented in Google Earth Engine, including:
- **Core mapping code:** [Seagrass Mapping Code](/NESP36_code/gee_mapping_code.js)
- **Mapping functions and parameters:** [Seagrass Mapping Code](/NESP36_code/gee_mapping_code_functions.js)

## X.5 Results and Demonstration

### X.5.1 Output Maps

The three mapping products provide complementary information about seagrass distribution:

![Seagrass Probability Map - Showing the continuous probability surface with values from 0-100%]

![Seagrass Extent Map - Showing the binary presence/absence of seagrass after threshold application]

![Seagrass Percent Cover Map - Showing the continuous estimation of seagrass cover percentage within the mapped extent]

![Seagrass Fractional Cover Map - Showing the seagrass fractional cover prodcut within the mapped extent]

The maps reveal spatial patterns in seagrass distribution across the study area, with notable variations related to bathymetry, wave exposure, and substrate type. Dense seagrass beds are concentrated in protected areas with suitable depth and substrate conditions, while more patchy distribution is observed in transition zones.

### X.5.2 Variable Importance

Analysis of variable importance across the Random Forest models reveals the key environmental drivers of seagrass distribution in the study area:

1. **Depth**: Consistently one of the most important predictors, reflecting the fundamental relationship between light availability and seagrass growth

2. **Spectral Information**: Sentinel-2 blue and green bands show high importance, particularly from specific percentile composites that effectively capture seagrass signatures

3. **Wave Exposure**: Wave power metrics significantly contribute to the models, indicating the importance of hydrodynamic conditions for seagrass establishment

4. **Substrate Complexity**: Rugosity metrics at various scales help differentiate suitable seagrass habitat from other benthic environments

![Variable Importance Chart - Bar chart showing the relative importance of different predictor variables across classification models]

### X.5.3 Model Performance

The methodology demonstrates strong performance across multiple validation metrics:

- **Overall Accuracy**: The binary seagrass extent map achieves `[xx - xx]` overall accuracy when validated against independent field observations
  
- **Probability Calibration**: The probability values show good alignment with observed seagrass presence frequency across the probability range

- **Cover Estimation Accuracy**: The percent cover model shows `[xx - xx]` correlation with field-measured cover values

The validation process follows the protocols outlined in Section 8 of the SOP, employing independent test data and appropriate accuracy metrics for each mapping product.

## X.6 Operational Considerations

This case study highlights several operational considerations when applying the SOP:

1. **Field Data Requirements**: Sufficient field observations across the full range of seagrass conditions are essential for robust model training and validation

2. **Processing Resources**: Google Earth Engine provides an efficient platform for processing large volumes of satellite data, but certain preprocessing steps (e.g., specialized atmospheric correction) may require additional resources

3. **Threshold Selection**: The choice of probability threshold for the extent map involves trade-offs between commission and omission errors, requiring careful consideration of the specific management needs

4. **Temporal Dynamics**: The multi-temporal approach helps overcome limitations of single-date imagery but requires consideration of potential seasonal variations in seagrass extent

## X.7 Future Applications and Refinements

The methodology demonstrated in this case study can be further refined in several ways:

1. **Species-Level Mapping**: With additional field data on species composition, the approach could be extended to differentiate between seagrass species

2. **Temporal Monitoring**: The established workflow could be applied to multiple time periods to assess changes in seagrass distribution over time

3. **Integration with Field Monitoring**: The mapping products could be integrated with ongoing field monitoring programs to provide a comprehensive understanding of seagrass ecosystem health

4. **Traditional Knowledge Integration**: Enhanced collaboration with Traditional Owners could incorporate valuable local knowledge into the mapping process

This case study demonstrates the effectiveness of the SOP for mapping seagrass distribution across a complex coastal environment while highlighting opportunities for continued refinement of the methodology based on specific local conditions and management needs.
