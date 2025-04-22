library(dplyr)
library(tidyr)
library(gbm3)
library(parallel)

# load BOSS data + covariate stack drill
boss_drill <- read.csv("boss_nesp36_covariate_drill.csv", header = T, stringsAsFactors = F)

# check data - dropped 16 points in water >30m so should be 384 points  
length(unique(boss_drill$drop_id))

# define covaraites used for modelling
model_covars = c('B2_p20','B2_p40','B2_p60','B2_p80',
                'B3_p20','B3_p40','B3_p60','B3_p80',
                'B4_p20','B4_p40','B4_p60','B4_p80',
                'depth','depth_std','slope','slope_avg','rugosity',
                'wf_max','wf_avg','wf_std')

# the different response variables to model
response_vars = c('sg_pa', 'sg_pct', 'ma_pa', 'ma_pct', 'sa_pa', 'sa_pct')
#response_vars = c('sg_pa', 'sg_pct')

# Process:
## montecarlo validation (1000 iters, 67% usage - in this case drops are the spatial hold out - this makes it quite pessimistic)
### fit all models
### apply seagrass thresholds
## return distribution
## calculate metrics

build_model_formula <- function(covars, response) {
  paste(response, "~", paste(covars, collapse = " + "))
}


fit_iteration <- function(seed, data, covars, responses, ntrees = 1000) {
  set.seed(seed)
  
  train_idx <- data$drop_id %in% sample(data$drop_id, 257) # spatially stratified sample (using drop location as hold outs ---> hard coded to 257 / 384 drops)
  #train_idx <- sample(1:nrow(data), size = floor(0.67 * nrow(data))) # random sample
  train_data <- data[train_idx, ]
  test_data <- data[-train_idx, ]
  
  model_results <- list()
  
  for (resp in responses) {
    formula_str <- build_model_formula(covars, resp)
    
    dist <- ifelse(grepl("_pa", resp), "bernoulli", ifelse(grepl("_pct", resp), "gaussian", stop("Response variable type not recognized")))
    #dist <- "gaussian"
    
    model <- gbm3::gbm(                  #hyperparams to match GEE model
      formula = as.formula(formula_str),
      data = train_data,
      n.trees = ntrees,
      n.minobsinnode = 1,
      shrinkage = 0.005,
      bag.fraction = 0.6,
      interaction.depth = 10,
      mFeatures = length(covars),
      distribution = dist
    )
    
    preds <- predict(model, newdata = test_data, n.trees = ntrees, type = ifelse(dist == "bernoulli", "response", "link"))
    
    if (grepl("_pa", resp)){
      model_results[[resp]] <- sum(as.numeric(preds > 0.5) == test_data[[resp]]) / nrow(test_data)
    }
    
    if (grepl("_pct", resp)){
      model_results[[resp]] <- sqrt(mean((preds - test_data[[resp]])^2))
    }
    
  }
  return(model_results)
}

fits <- mclapply(1:20, fit_iteration, boss_drill, model_covars, response_vars, 1000)
fits_df <- bind_rows(fits)

# summarise the metrics into a meaningful output

summmarise_accuracy <- function(df) {
  spit_95 <- function(x) {round(as.numeric(quantile(x, c(0.025, 0.975))),2)}
  # make for each
  print(paste0("Seagrass presence p(0.5) accuracy: ", round(median(df$sg_pa),2), " (", spit_95(df$sg_pa)[1],"-",spit_95(df$sg_pa)[2],")"))
  print(paste0("Macroalgae presence p(0.5) accuracy: ", round(median(df$ma_pa),2), " (", spit_95(df$ma_pa)[1],"-",spit_95(df$ma_pa)[2],")"))
  print(paste0("Sand presence p(0.5) accuracy: ", round(median(df$sa_pa),2), " (", spit_95(df$sa_pa)[1],"-",spit_95(df$sa_pa)[2],")"))
  
  print(paste0("Seagrass %cover RMSE: ", round(median(df$sg_pct),2), " (", spit_95(df$sg_pct)[1],"-",spit_95(df$sg_pct)[2],")"))
  print(paste0("Macroalgae %cover RMSE: ", round(median(df$ma_pct),2), " (", spit_95(df$ma_pct)[1],"-",spit_95(df$ma_pct)[2],")"))
  print(paste0("Sand %cover RMSE: ", round(median(df$sa_pct),2), " (", spit_95(df$sa_pct)[1],"-",spit_95(df$sa_pct)[2],")"))
}

summmarise_accuracy(fits_df)
