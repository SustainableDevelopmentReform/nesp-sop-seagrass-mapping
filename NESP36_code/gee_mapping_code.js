
/*
###############################################################

Global intertidal and sub-tidal mapping (seagrass focus)

Copyright (c) 2025 Mitchell Lyons, UNSW Sydney. All rights reserved.

IP and copyright owners:
- Univeristy of New South Wales

This work is licensed under the terms of the CC BY 4.0 license.  
see <https://creativecommons.org/licenses/by/4.0/>

Contact:
- Mitchell Lyons
- mitchell.lyons@unsw.edu.au; mitchell.lyons@gmail.com

###############################################################
*/

var funs = require("gee_mapping_code_functions");

/*
### Bespoke mapping testing script ###
- designed for small areas, e.g. <5,000 km2
- generate Sentinel-2 / Landsat 8 time series (automatic)
- optionally, load a custom image input (e.g. Planet)
- load and sample training data
- fit a ML model (e.g. RF or BRT)
- visualise/export reuslts
*/

/*
************************************
User defined inputs/geometries
- define these here in this script
*/
// parameter set to load
var params = seagrass_params.tayaritja_BOSSprob_24;
// seagrass type visualisation - extent, prob, binary?
var sg_vis = viridis_float;
var show_sg_points = true;
// output geometries
var output_extent = tayaritja; // this geometry will need to be created within the GEE environemnt (manually in JS API)
var training_extent = tayaritja; // this can be that same as above, or wider, to gain more samples
// sensors to use
var use_s2 = true;
var use_ls8 = false;
var use_superdove = true;
var use_doveR = false;
var use_spot = false;
// S2 cloud_masking
var s2_clouds = "gcsp"; // ['slc' = use S2 standard SLC product; 'gcsp' = use Google Cloud Score + product]
//  additional metrics
var depth_metrics = false;
var use_waves = false;
// export results?
var export_training = false; // export the trinaing library?
var export_s2_stack = false; // export the Sentinel-2 image stack?
var do_export = "asset"; // export to "asset" or "drive" or "false"
/*
************************************
  ||
  ||
  \/
************************************
- Override start and finish dates for multitemporal mosaics?
- Override cloudy scene percentage?
*/
var override_date = false;

if (override_date) {
  var year = "2018";
  params.start_date = year + "-01-01";
  params.end_date = year + "-12-31";
  print("Mapping year: ", year);
} else {
  var year = "--";
  print("Mapping year: ", params.start_date + " to " + params.end_date);
}

var override_cloud = false;
if (override_cloud) {
  params.cloudy_threshold = 50;
}
/*
************************************
  ||
  ||
  \/
********************************************************************
Automatically loaded datasets - DO NOT MODIFY
- these are controlled via users/mitchest/seagrass_reefs_etal/self_contained/seagrass_params
*/
var training_data_set = ee.FeatureCollection(params.training_data_set);
var depth = ee.Image(params.depth).rename('depth');
if (use_waves) {var waves = ee.Image(params.waves)}
//var manual_mask = ee.FeatureCollection(params.manual_mask);
var manual_mask = ee.Image(params.manual_mask);
if (use_doveR) {var doveR = ee.Image(params.doveR)}
if (use_superdove) {var superdove = ee.Image(params.superdove)}
if (use_spot) {var spot = ee.Image(params.spot)}
/*
********************************************************************
  ||
  ||
  \/
********************************************************************
Extra processing on field data - MODIFY if custom_field_data == true
- this is a chance to modify the inout fiedls data (e.g. how much, what dates, what filtering etc.)
*/
var custom_field_data = false; // set to false to skip

/*
// this is for when the field data has a "year", "cover" and "pa" attribute
if (custom_field_data) {
  // year filter - can be `.lt`, `.lte`, `.eq` ... etc., or combined ee.Filter.and()
  var filter_year = ee.Filter.and(ee.Filter.gte('year', 2019), ee.Filter.lte('year', 2021));
  //var filter_year = ee.Filter.gte('year', 2022);
  // percentage to cutdown data to
  var trim_percentage = 1;
  // anything else? (these can be based on anyfield in the data)
  //  - if not used, just use a the empty notNull filter
  //var filter_custom1 = ee.Filter.notNull([params.class_field]);
  var filter_custom1 = ee.Filter.or(ee.Filter.gte('sg_cover', 20), ee.Filter.eq('sg_pa', 0));
  // summarise what you've done breifly (so it can be recorded)
  var custom_field_params = '2022, trim:1, cover:>20';
  
  // DON'T MODIFY FROM HERE DOWN -----
  // apply the filters
  print("Imported training data size:", training_data_set.size());
  training_data_set = training_data_set.filter(filter_year)
                                       .filter(filter_custom1)
                                       .randomColumn()
                                       .filter(ee.Filter.lte('random', trim_percentage));
  print("Filtered training data:", training_data_set.size());
  // Add the params to the properties for image export
  params.custom_field_params = custom_field_params;
}
*/

// this is for when the field data is combined geomorphic + benthic + seagrass classes
if (custom_field_data) {
  // use this to filter to geomorphic classes
  training_data_set = training_data_set.filter(ee.Filter.eq("benthic", 1));
}


print("Training data set size: ", training_data_set.filterBounds(training_extent).size());
print("Training data classes: ", training_data_set.filterBounds(training_extent).aggregate_histogram(params.class_field));

/*
********************************************************************
*/


Map.centerObject(output_extent, 14);


// make masks for clipping
var output_extent_mask = ee.Image().byte().paint(ee.Feature(output_extent, {zone: 1}), "zone");
var training_extent_mask = ee.Image().byte().paint(ee.Feature(training_extent, {zone: 1}), "zone");

if (params.land_mask) {
  var osm_vector = osm.filterBounds(output_extent).geometry().intersection(output_extent, 10);
  var osm_mask = ee.Image().byte().paint(ee.Feature(osm_vector, {zone: 1}), "zone").unmask(0);
}

if (params.apply_manual_mask) {
  //var manual_vector = manual_mask.filterBounds(output_extent).geometry().intersection(output_extent, 10);
  //var manual_mask_i = ee.Image().byte().paint(ee.Feature(manual_vector, {zone: 1}), "zone").unmask(0);
  var manual_mask_i = manual_mask.select("reef_mask");
}

if (params.depth_positive) {
  depth = depth.multiply(-1);
}

if (!params.depth_only_map) {
  depth = depth.unmask(0, false).updateMask(output_extent_mask);
}

if (depth_metrics) {
  var slope = ee.Terrain.slope(depth).rename('slope');
  var slope_avg = slope.focalMean(10).rename('slope_avg');
  var depth_std = depth.reduceNeighborhood(ee.Reducer.stdDev(), ee.Kernel.circle(2)).rename('depth_std');
  var rugosity = depth.focalMin(1, 'square').subtract(depth.focalMax(1, 'square')).rename('rugosity');
  Map.addLayer(slope, {}, "Slope", false);
  Map.addLayer(slope_avg, {}, "Slope average", false);
  Map.addLayer(depth_std, {}, "Depth variance", false);
  Map.addLayer(rugosity, {}, "Rugosity", false);
  Map.addLayer(depth, {}, "Depth", false);
}

if (use_waves) {
  Map.addLayer(waves, {}, "Wave model", false);
}



//Map.addLayer(depth, {min:-30, max: 0}, "Depth layer", false);




// ################
// Sentinel-2 stack
// ################

if (use_s2) {
  // build the collections, then apply the masking, choose the estimator (e.g. med, interval, variance)
  // Build a data stack
  if (s2_clouds == 'slc') {
    var s2_pixel_stack = sentinel2_2A
    .filterBounds(training_extent)
    .filterDate(params.start_date, params.end_date)
    .filter(ee.Filter.lt("CLOUDY_PIXEL_PERCENTAGE", params.cloudy_threshold))
    .map(funs.maskS2clouds_2A(params.s2_keep_bands, training_extent_mask));
  }
  
  if (s2_clouds == 'gcsp') {
    var s2_pixel_stack = sentinel2_2A
    .filterBounds(training_extent)
    .filterDate(params.start_date, params.end_date)
    .filter(ee.Filter.lt("CLOUDY_PIXEL_PERCENTAGE", params.cloudy_threshold))
    .linkCollection(sentinel2_2A_gcsp, ['cs_cdf'])
    .map(funs.maskS2clouds_2A_gcsp(params.s2_keep_bands, training_extent_mask, params.gcsp_thresh));
  }
  
  var s2_stack_median = s2_pixel_stack.reduce(ee.Reducer.median()).uint16(); // dont need median separately to p50
  var s2_stack_percentiles = s2_pixel_stack.reduce(ee.Reducer.percentile(ee.List.sequence(20,80,20))).uint16();
  
  var s2_stack = s2_stack_median
          .addBands(s2_stack_percentiles);
  
  if (params.segment_image) {
    s2_stack = ee.Algorithms.Image.Segmentation.SNIC(s2_stack)
                  .regexpRename('_mean', '');
    s2_stack = s2_stack.select(ee.List.sequence(1, s2_stack.bandNames().length().subtract(2))); // remove the clusters & seed bands
    s2_stack = s2_stack.cast(ee.Dictionary.fromLists(s2_stack.bandNames(), ee.List.repeat('uint16', s2_stack.bandNames().length()))); // cast at int16 again
   // print(s2_stack)
  }
  
  if (export_s2_stack) {
    var s2_stack_exp = s2_stack_median.addBands(s2_stack_percentiles);
    print('S2_stack_exp');
    print(s2_stack_exp);
  }
  
  s2_stack = s2_stack
          .addBands(s2_stack.select('B4_p60').divide(s2_stack.select('B3_p60')).rename('rg_median'))
          .addBands(s2_stack.select('B4_p60').divide(s2_stack.select('B2_p60')).rename('rb_median'))
          .addBands(s2_stack.normalizedDifference(["B8_p60", "B4_p60"]).rename("ndvi"))
          .addBands(s2_stack.normalizedDifference(["B3_p60", "B8_p60"]).rename("ndwi1"))
  
  if (depth_metrics) {
    s2_stack = s2_stack
          .addBands(depth).addBands(depth_std)
          .addBands(slope).addBands(slope_avg)
          .addBands(rugosity);
  }
  
  if (waves) {
    s2_stack = s2_stack.addBands(waves);
  }
  

  Map.addLayer(s2_stack, s2_vis, "Sentinel-2 stack", false);
  //print(s2_stack.bandNames());
  
  //Map.addLayer(s2_stack.select(["B3_p60"]).glcmTexture(3), {}, "S2 B3 GLCM layers", false);
  //Map.addLayer(s2_stack.select(["B4_median","B3_median","B2_median"]).unitScale(0,4000).rgbToHsv());
}

// ###############
// Landsat 8 stack
// ###############

if (use_ls8) {
  // build the collections, then apply the masking, choose the estimator (e.g. med, interval, variance)
  // Build a data stack
  var ls8_pixel_stack = landsat8_L2
    .filterBounds(training_extent)
    .filterDate(params.start_date, params.end_date)
    .filter(ee.Filter.lt("CLOUD_COVER", params.cloudy_threshold))
  //print(ls8_pixel_stack.limit(1))
    .map(funs.maskLS8clouds_L2(params.ls8_keep_bands, training_extent_mask));
  
  var ls8_stack_median = ls8_pixel_stack.reduce(ee.Reducer.median()).uint16();
  var ls8_stack_int2050 = ls8_pixel_stack.reduce(ee.Reducer.intervalMean(20, 50)).uint16().regexpRename('_mean', '_int2050');
  var ls8_stack_int5080 = ls8_pixel_stack.reduce(ee.Reducer.intervalMean(50, 80)).uint16().regexpRename('_mean', '_int5080');
  var ls8_stack_stddev = ls8_pixel_stack.reduce(ee.Reducer.stdDev()).uint16();
  
  var ls8_stack = ls8_stack_median
          .addBands(ls8_stack_int5080)
          .addBands(ls8_stack_int2050)
          .addBands(ls8_stack_stddev)
          .addBands(ls8_stack_median.select('SR_B4_median').divide(ls8_stack_median.select('SR_B3_median')).rename('rg_median'))
          .addBands(ls8_stack_median.select('SR_B4_median').divide(ls8_stack_median.select('SR_B2_median')).rename('rb_median'))
          .addBands(ls8_stack_int2050.select('SR_B4_int2050').divide(ls8_stack_int2050.select('SR_B3_int2050')).rename('rg_int2050'))
          .addBands(ls8_stack_int2050.select('SR_B4_int2050').divide(ls8_stack_int2050.select('SR_B2_int2050')).rename('rb_int2050'))
          .addBands(ls8_stack_int5080.select('SR_B4_int5080').divide(ls8_stack_int5080.select('SR_B3_int5080')).rename('rg_int5080'))
          .addBands(ls8_stack_int5080.select('SR_B4_int5080').divide(ls8_stack_int5080.select('SR_B2_int5080')).rename('rb_int5080'))
          .addBands(ls8_stack_int5080.normalizedDifference(["SR_B5_int5080", "SR_B4_int5080"]).rename("ndvi"))
          .addBands(ls8_stack_int5080.normalizedDifference(["SR_B3_int5080", "SR_B5_int5080"]).rename("ndwi1"));
  Map.addLayer(ls8_stack, ls8_vis, "Landsat-8 stack", false);
}



if (use_doveR || use_superdove || use_spot) {
  
  // #############
  // Planet stacks
  // #############
  if (use_doveR) {
    var doveR_stack = doveR
            .addBands(doveR.select('b3').divide(doveR.select('b2')).rename('rg'))
            .addBands(doveR.select('b3').divide(doveR.select('b1')).rename('rb'))
            .addBands(doveR.normalizedDifference(["b4", "b3"]).rename("ndvi"))
            .addBands(doveR.normalizedDifference(["b2", "b4"]).rename("ndwi1"))
            .addBands(depth);//.addBands(slope);
    Map.addLayer(doveR_stack, {min:0, max:3000}, "Planet Dove-R stack", false);
  }
  
  if (use_superdove) {
    var superdove_stack = superdove
            .addBands(superdove.select('b6').divide(superdove.select('b4')).rename('rg'))
            .addBands(superdove.select('b6').divide(superdove.select('b2')).rename('rb'))
            .addBands(superdove.normalizedDifference(["b8", "b6"]).rename("ndvi"))
            .addBands(superdove.normalizedDifference(["b4", "b8"]).rename("ndwi1"))   
            .addBands(depth)
    
    if (depth_metrics) {
    superdove_stack = superdove_stack
          .addBands(depth).addBands(depth_std)
          .addBands(slope).addBands(slope_avg)
          .addBands(rugosity);
  }
  
  if (waves) {
    superdove_stack = superdove_stack.addBands(waves);
  }
    
    Map.addLayer(superdove_stack, planetsd_vis, "Planet SuperDove stack", false);
  }
  
  // #############
  // SPOT stack
  // #############
  if (use_spot) {
    var spot_stack = spot
            .addBands(spot.select('b3').divide(spot.select('b2')).rename('rg'))
            .addBands(spot.select('b3').divide(spot.select('b1')).rename('rb'))
            .addBands(spot.normalizedDifference(["b4", "b3"]).rename("ndvi"))
            .addBands(spot.normalizedDifference(["b2", "b4"]).rename("ndwi1"))
            .addBands(depth);//.addBands(slope);
    Map.addLayer(spot_stack, {min:0, max:3000}, "SPOT MS/PS stack", false);
  }
  
  // do some things here once we add band ratios etc.

}


Map.addLayer(osm_mask.selfMask(), {min:0, max:1}, "OSM land mask", false);
if (params.apply_manual_mask) Map.addLayer(manual_mask_i.selfMask(), {min:0, max:1}, "Manual mask", false);


// #################
// Sample / classify
// #################

// load the classifier functions
var sample_classify = funs.sample_classify;
var sample_export = funs.sample_export;


// Classify an image and display

// Landsat
if (use_ls8) {
  var ls8_seagrass = sample_classify(ls8_stack, output_extent_mask,
                                       training_data_set, params.class_field, 30, params.ls8_model_bands, params.print_model, params.output_mode, params.model_arch);
  // post-processing
  if (params.land_mask) ls8_seagrass = ls8_seagrass.updateMask(osm_mask.eq(0));
  if (params.depth_mask) ls8_seagrass = ls8_seagrass.updateMask(depth.gt(params.depth_thresh));
  if (params.apply_manual_mask) ls8_seagrass = ls8_seagrass.updateMask(manual_mask_i.eq(1));
  
  Map.addLayer(ls8_seagrass, sg_vis, "LS8: " + params.study_site_name, false);
  //Map.addLayer(ls8_seagrass.gt(prob_thresh).selfMask(), sm_vis, "LS8 seagrass extent", false);
}


// Sentinel-2
if (use_s2) {
  if (export_training) {
    var s2_training = sample_export(s2_stack, training_data_set, params.class_field, 10, params.s2_model_bands);
    Map.addLayer(s2_training, {}, "Training data points", false);
  }
  var s2_seagrass = sample_classify(s2_stack, output_extent_mask,
                                       training_data_set, params.class_field, 10, params.s2_model_bands, params.print_model,
                                       params.output_mode, params.model_arch, 500, 2);
  // post-processing
  if (params.land_mask) s2_seagrass = s2_seagrass.updateMask(osm_mask.eq(0));
  if (params.depth_mask) s2_seagrass = s2_seagrass.updateMask(depth.gt(params.depth_thresh));
  if (params.apply_manual_mask) s2_seagrass = s2_seagrass.updateMask(manual_mask_i.eq(1));
  
  Map.addLayer(s2_seagrass, sg_vis, "S2: " + params.study_site_name, false);
  Map.addLayer(s2_seagrass.gt(params.prob_thresh).selfMask(), sg_binary, "S2 seagrass extent", false);
}


if (use_doveR || use_superdove || use_spot) {
  if (use_doveR) {
    // Planet Dove-R
    var doveR_seagrass = sample_classify(doveR_stack, output_extent_mask,
                                         training_data_set, params.class_field, 3, params.visnir_bands, params.print_model, params.output_mode, params.model_arch);
    // post-processing
    if (params.land_mask) doveR_seagrass = doveR_seagrass.updateMask(osm_mask.eq(0));
    if (params.depth_mask) doveR_seagrass = doveR_seagrass.updateMask(depth.gt(params.depth_thresh));
    if (params.apply_manual_mask) doveR_seagrass = doveR_seagrass.updateMask(manual_mask_i.eq(1));
    Map.addLayer(doveR_seagrass, sg_vis, "SPOT MS/PS seagrass prob.", false);
    Map.addLayer(doveR_seagrass.gt(params.prob_thresh).selfMask(), sg_binary, "SPOT MS/PS seagrass extent", false);  
  }
  
  if (use_superdove) {
  // Planet SuperDove
  var superdove_seagrass = sample_classify(superdove_stack, output_extent_mask,
                                           training_data_set, params.class_field, 3, params.sd_model_bands, params.print_model, params.output_mode, params.model_arch);
  // post-processing
    if (params.land_mask) superdove_seagrass = superdove_seagrass.updateMask(osm_mask.eq(0));
    if (params.depth_mask) superdove_seagrass = superdove_seagrass.updateMask(depth.gt(params.depth_thresh));
    if (params.apply_manual_mask) superdove_seagrass = superdove_seagrass.updateMask(manual_mask_i.eq(1));
    Map.addLayer(superdove_seagrass, sg_vis, "Planet SuperDove2: " + params.study_site_name, false);
    Map.addLayer(superdove_seagrass.gt(params.prob_thresh).selfMask(), sg_binary, "Planet SuperDove seagrass extent", false);  
  }
  
  if (use_spot) {
    // SPOT MS + PS
    var spot_seagrass = sample_classify(spot_stack, output_extent_mask,
                                         training_data_set, params.class_field, 3, params.visnir_bands, params.print_model, params.output_mode, params.model_arch);
    // post-processing
    if (params.land_mask) spot_seagrass = spot_seagrass.updateMask(osm_mask.eq(0));
    if (params.depth_mask) spot_seagrass = spot_seagrass.updateMask(depth.gt(params.depth_thresh));
    if (params.apply_manual_mask) spot_seagrass = spot_seagrass.updateMask(manual_mask_i.eq(1));
    Map.addLayer(spot_seagrass, sg_vis, "SPOT MS/PS seagrass prob.", false);
    Map.addLayer(spot_seagrass.gt(params.prob_thresh).selfMask(), sg_binary, "SPOT MS/PS seagrass extent", false);  
  }
}



Map.addLayer(training_data_set, {}, "All training points", false);
if (show_sg_points) {Map.addLayer(training_data_set.filter(ee.Filter.gt(params.class_field, 0)), {color:"red"}, "Seagrass training points", false);}
Map.addLayer(output_extent, {}, "Working extent", false);


// ############
// Export imagery & training data
// ############
if(do_export =="drive") {
  //Sentinel-2
  if (export_s2_stack) {
    Export.image.toDrive({
      image: s2_stack_exp,
      description: params.study_site_name + "S2_" + year, 
      folder: "Sentinel2_exports", 
      fileNamePrefix: params.study_site_name + "S2_" + year,
      region: output_extent, 
      scale: 10, 
      crs: "EPSG:4326",
      maxPixels: 1e13, 
      skipEmptyTiles: true
    });
  }
    
  if (export_training) {
      Export.table.toDrive({
        collection: s2_training,
        description: "training",
        folder: "folder",
        fileNamePrefix: "S2_trianing",
        fileFormat: "SHP"
      });
    }
}


// ############
// Export maps 
// ############

if (do_export == "drive") {
  // Sentinel-2
  if (use_s2) {
    Export.image.toDrive({
      image: s2_seagrass.set(params), 
      description: "S2_seagrass_export",
      folder: "folder",
      fileNamePrefix: "seagrass_" + params.study_site_name + "S2_",
      region: output_extent,
      scale: 10,
      crs: "EPSG:4326",
      maxPixels: 1e13,
      skipEmptyTiles: true
    });
  }

  // Landsat 8
  if (use_ls8) {
    Export.image.toDrive({
      image: ls8_seagrass.set(params), 
      description: "ls8_seagrass_export",
      folder: "seagrass_exports",
      fileNamePrefix: "ls8_seagrass_" + params.study_site_name,
      region: output_extent,
      scale: 30,
      crs: "EPSG:4326",
      maxPixels: 1e13,
      skipEmptyTiles: true
    });
  }
  // Dove
  if (use_superdove) {
    Export.image.toDrive({
      image: superdove_seagrass.set(params), 
      description: "planet_seagrass_export",
      folder: "seagrass_exports",
      fileNamePrefix: "seagrass_" + params.study_site_name + "sd_",
      region: output_extent,
      scale: 3,
      crs: "EPSG:4326",
      maxPixels: 1e13,
      skipEmptyTiles: true
    });
  }
}

if (do_export == "asset") {
  // Sentinel-2
  if (use_s2) {
    Export.image.toAsset({
      image: s2_seagrass.set(params), 
      description: params.study_site_name + "_" + year + "_s2",
      assetId: "projects/..." + params.study_site_name + "_" + year + "_s2",
      region: output_extent,
      scale: 10,
      crs: "EPSG:4326",
      maxPixels: 1e13,
      pyramidingPolicy: {"default":"mode"},
    });
  
    if (export_s2_stack) {
      Export.image.toAsset({
        image: s2_stack_exp, 
        description: "S2_stack", 
        assetId: "projects/..." + params.study_site_name + "S2_stack",
        region: output_extent,
        scale: 10, 
        crs: "EPSG:4326", 
        maxPixels: 1e13, 
        pyramidingPolicy:{"default":"mode"}
      });
    }
  }
  // Landsat 8
  if (use_ls8) {
    Export.image.toAsset({
      image: ls8_seagrass.set(params), 
      description: "ls8_seagrass_export",
      assetId: "projects/..." + params.study_site_name,
      region: output_extent,
      scale: 30,
      crs: "EPSG:4326",
      maxPixels: 1e13,
      pyramidingPolicy: {"default":"mode"},
    });
  }
  // Dove
  if (use_superdove) {
    Export.image.toAsset({
      image: superdove_seagrass.set(params), 
      description: "superdove_seagrass_export",
      assetId: "projects/..." + params.study_site_name + "_sd",
      region: output_extent,
      scale: 3,
      crs: "EPSG:4326",
      maxPixels: 1e13,
      pyramidingPolicy: {"default":"mode"},
    });
  }
  // SPOT
  if (use_spot) {
    Export.image.toAsset({
      image: spot_seagrass.set(params), 
      description: "spot_seagrass_export",
      assetId: "projects/..." + params.study_site_name + "_spot",
      region: output_extent,
      scale: 3,
      crs: "EPSG:4326",
      maxPixels: 1e13,
      pyramidingPolicy: {"default":"mode"},
    });
  }
}
