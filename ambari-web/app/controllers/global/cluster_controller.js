/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

var App = require('app');

App.ClusterController = Em.Controller.extend({
  name: 'clusterController',
  cluster:null,
  isLoaded: false,
  updateLoadStatus: function(item){
    var loadList = this.get('dataLoadList');
    var loaded = true;
    loadList.set(item, true);
    for(var i in loadList){
      if(loadList.hasOwnProperty(i) && !loadList[i] && loaded){
        loaded = false;
      }
    }
    this.set('isLoaded', loaded);
  },
  dataLoadList: Em.Object.create({
    'hosts': false,
    'runs': false,
    'services': false,
    'cluster' : false,
    'racks' : false,
    'alerts' : false,
    'users' : false
  }),
  /**
   * load cluster name
   */
  loadClusterName: function(reload){
    if(this.get('clusterName') && !reload){
      return;
    }
    var self = this;
    var url = (App.testMode) ? '/data/clusters/info.json' : '/api/clusters';
    $.ajax({
      async: false,
      type: "GET",
      url: url,
      dataType: 'json',
      timeout: 5000,
      success: function (data) {
        self.set('cluster', data.items[0]);
      },
      error: function (request, ajaxOptions, error) {
        console.log('failed on loading cluster name');
        self.set('isLoaded', true);
      },
      statusCode: require('data/statusCodes')
    });
  },

  getUrl: function(testUrl, url){
    return (App.testMode) ? testUrl: '/api/clusters/' + this.get('clusterName') + url;
  },

  /**
   * Provides the URL to use for NAGIOS server. This URL
   * is helpful in getting alerts data from server and also
   * in populating links in UI.
   *
   * If null is returned, it means NAGIOS service is not installed.
   */
  nagiosUrl: function () {
    if (App.testMode) {
      return 'http://nagiosserver/nagios';
    } else {
      // We want live data here
      var svcs = App.Service.find();
      var nagiosSvc = svcs.findProperty("serviceName", "NAGIOS");
      if (nagiosSvc) {
        var svcComponents = nagiosSvc.get('components');
        if (svcComponents) {
          var nagiosSvcComponent = svcComponents.findProperty("componentName", "NAGIOS_SERVER");
          if(nagiosSvcComponent){
            var hostName = nagiosSvcComponent.get('host.hostName');
            if(hostName){
              return "http://"+hostName+"/nagios";
            }
          }
        }
      }
      return null;
    }
  }.property('dataLoadList.services'),

  isNagiosInstalled: function(){
    if(App.testMode){
      return true;
    }else{
      var svcs = App.Service.find();
      var nagiosSvc = svcs.findProperty("serviceName", "NAGIOS");
      return nagiosSvc!=null;
    }
  }.property('dataLoadList.services'),

  /**
   * Sorted list of alerts.
   * Changes whenever alerts are loaded.
   */
  alerts: function () {
    var alerts = App.Alert.find();
    var alertsArray = alerts.toArray();
    var sortedArray = alertsArray.sort(function (left, right) {
      var statusDiff = right.get('status') - left.get('status');
      if (statusDiff == 0) { // same error severity - sort by time
        var rightTime = right.get('date');
        var leftTime = left.get('time');
        rightTime = rightTime ? rightTime.getTime() : 0;
        leftTime = leftTime ? leftTime.getTime() : 0;
        statusDiff = rightTime - leftTime;
      }
      return statusDiff;
    });
    return sortedArray;
  }.property('dataLoadList.alerts'),

  /**
   * This method automatically loads alerts when Nagios URL
   * changes. Once done it will trigger dataLoadList.alerts
   * property, which will trigger the alerts property.
   */
  loadAlerts: function () {
    var nagiosUrl = this.get('nagiosUrl');
    if (nagiosUrl) {
      var lastSlash = nagiosUrl.lastIndexOf('/');
      if (lastSlash > -1) {
        nagiosUrl = nagiosUrl.substring(0, lastSlash);
      }
      var dataUrl;
      var ajaxOptions = {
        dataType: "jsonp",
        jsonp: "jsonp",
        context: this,
        complete: function (jqXHR, textStatus) {
          this.updateLoadStatus('alerts')
        }
      };
      if (App.testMode) {
        dataUrl = "/data/alerts/alerts.jsonp";
        ajaxOptions.jsonpCallback = "jQuery172040994187095202506_1352498338217";
      } else {
        dataUrl = nagiosUrl + "/hdp/nagios/nagios_alerts.php?q1=alerts&alert_type=all";
      }
      App.HttpClient.get(dataUrl, App.alertsMapper, ajaxOptions);
    } else {
      this.updateLoadStatus('alerts');
      console.log("No Nagios URL provided.")
    }
  }.observes('nagiosUrl'),

  /**
   *
   *  load all data and update load status
   */
  loadClusterData: function(){
    var self = this;
    if(!this.get('clusterName')){
        return;
    }

     var clusterUrl = this.getUrl('/data/clusters/cluster.json', '?fields=Clusters');
     var hostsUrl = this.getUrl('/data/hosts/hosts.json', '/hosts?fields=*');
     var servicesUrl1 = this.getUrl('/data/dashboard/services.json', '/services?ServiceInfo/service_name!=MISCELLANEOUS&ServiceInfo/service_name!=DASHBOARD&fields=components/host_components/*');
     var servicesUrl2 = this.getUrl('/data/dashboard/serviceComponents.json', '/services?ServiceInfo/service_name!=MISCELLANEOUS&ServiceInfo/service_name!=DASHBOARD&fields=components/ServiceComponentInfo');
     var usersUrl = App.testMode ? '/data/users/users.json' : '/api/users/?fields=*';
     var runsUrl = App.testMode ? "/data/apps/runs.json" : "/api/jobhistory/workflow";

     var racksUrl = "/data/racks/racks.json";

    App.HttpClient.get(racksUrl, App.racksMapper,{
      complete:function(jqXHR, textStatus){
        self.updateLoadStatus('racks');
      }
    },function(jqXHR, textStatus){
      self.updateLoadStatus('racks');
    });

    App.HttpClient.get(clusterUrl, App.clusterMapper,{
      complete:function(jqXHR, textStatus){
        self.updateLoadStatus('cluster');
      }
    },function(jqXHR, textStatus){
      self.updateLoadStatus('cluster');
    });

    App.HttpClient.get(runsUrl, App.runsMapper,{
      complete:function(jqXHR, textStatus) {
        self.updateLoadStatus('runs');
      }
    },function(jqXHR, textStatus){
      self.updateLoadStatus('runs');
    });

    App.HttpClient.get(hostsUrl, App.hostsMapper,{
      complete:function(jqXHR, textStatus){
        self.updateLoadStatus('hosts');
      }
    },function(jqXHR, textStatus){
      self.updateLoadStatus('hosts');
    });

    App.HttpClient.get(usersUrl, App.usersMapper,{
      complete:function(jqXHR, textStatus){
        self.updateLoadStatus('users');
      }
    },function(jqXHR, textStatus){
      self.updateLoadStatus('users');
    });

    //////////////////////////////
    // Hack for services START  //
    //////////////////////////////
    var metricsJson = null;
    var serviceComponentJson = null;
    var metricsMapper = {
        map: function(data){
          metricsJson = data;
        }
    };
    var serviceComponentMapper = {
      map: function (data) {
        serviceComponentJson = data;
        if (metricsJson != null && serviceComponentJson != null) {
          var hdfsSvc1 = null;
          var hdfsSvc2 = null;
          var mrSvc1 = null;
          var mrSvc2 = null;
          var hbaseSvc1 = null;
          var hbaseSvc2 = null;
          metricsJson.items.forEach(function (svc) {
            if (svc.ServiceInfo.service_name == "HDFS") {
              hdfsSvc1 = svc;
            }
            if (svc.ServiceInfo.service_name == "MAPREDUCE") {
              mrSvc1 = svc;
            }
            if (svc.ServiceInfo.service_name == "HBASE") {
              hbaseSvc1 = svc;
            }
          });
          serviceComponentJson.items.forEach(function (svc) {
            if (svc.ServiceInfo.service_name == "HDFS") {
              hdfsSvc2 = svc;
            }
            if (svc.ServiceInfo.service_name == "MAPREDUCE") {
              mrSvc2 = svc;
            }
            if (svc.ServiceInfo.service_name == "HBASE") {
              hbaseSvc2 = svc;
            }
          });
          var nnC1 = null;
          var nnC2 = null;
          var jtC1 = null;
          var jtC2 = null;
          var hbm1 = null;
          var hbm2 = null;
          if (hdfsSvc1) {
            hdfsSvc1.components.forEach(function (c) {
              if (c.ServiceComponentInfo.component_name == "NAMENODE") {
                nnC1 = c;
              }
            });
          }
          if (hdfsSvc2) {
            hdfsSvc2.components.forEach(function (c) {
              if (c.ServiceComponentInfo.component_name == "NAMENODE") {
                nnC2 = c;
              }
            });
          }
          if (mrSvc1) {
            mrSvc1.components.forEach(function (c) {
              if (c.ServiceComponentInfo.component_name == "JOBTRACKER") {
                jtC1 = c;
              }
            });
          }
          if (mrSvc2) {
            mrSvc2.components.forEach(function (c) {
              if (c.ServiceComponentInfo.component_name == "JOBTRACKER") {
                jtC2 = c;
              }
            });
          }
          if (hbaseSvc1) {
            hbaseSvc1.components.forEach(function (c) {
              if (c.ServiceComponentInfo.component_name == "HBASE_MASTER") {
                hbm1 = c;
              }
            });
          }
          if (hbaseSvc2) {
            hbaseSvc2.components.forEach(function (c) {
              if (c.ServiceComponentInfo.component_name == "HBASE_MASTER") {
                hbm2 = c;
              }
            });
          }
          if (nnC1 && nnC2) {
            nnC1.ServiceComponentInfo = nnC2.ServiceComponentInfo;
          }
          if (jtC1 && jtC2) {
            jtC1.ServiceComponentInfo = jtC2.ServiceComponentInfo;
          }
          if (hbm1 && hbm2) {
            hbm1.ServiceComponentInfo = hbm2.ServiceComponentInfo;
          }
          App.servicesMapper.map(metricsJson);
          self.updateLoadStatus('services');
        }
      }
    }
    App.HttpClient.get(servicesUrl1, metricsMapper,{
      complete:function(jqXHR, textStatus){
        App.HttpClient.get(servicesUrl2, serviceComponentMapper,{
          complete:function(jqXHR, textStatus){
          }
        });
      }
    });
    /////////////////////////////
    // Hack for services END   //
    /////////////////////////////

  },

  clusterName: function(){
    return (this.get('cluster')) ? this.get('cluster').Clusters.cluster_name : null;
  }.property('cluster')
})
