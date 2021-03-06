App_kaggle = {
  web3Provider: null,
  contracts: {},

  init: async function() {
    // Load competitions.
    // Load the list of competitions from contracts / json file
    // Insert it on front end

    return await App_kaggle.initWeb3();
  },

  initWeb3: async function() {
    // Modern dapp browsers...
    if (window.ethereum) {
      App_kaggle.web3Provider = window.ethereum;
      try {
        // Request account access
        await window.ethereum.enable();
      } catch (error) {
        // User denied account access...
        console.error("User denied account access")
      }
    }
    // Legacy dapp browsers...
    else if (window.web3) {
      App_kaggle.web3Provider = window.web3.currentProvider;
    }
    // If no injected web3 instance is detected, fall back to Ganache
    else {
      App_kaggle.web3Provider = new Web3.providers.HttpProvider('http://localhost:7545');
    }
    web3 = new Web3(App_kaggle.web3Provider);

    return App_kaggle.initContract();
  },

  initContract: function() {
    $.getJSON('Daggle.json', function(data){
      var DaggleArtifact = data;
      App_kaggle.contracts.Daggle = TruffleContract(DaggleArtifact);
      App_kaggle.contracts.Daggle.setProvider(App_kaggle.web3Provider);
      return App_kaggle.getCompetitions();
    });
    return;
  },
  getCompetitions: function(){
    App_kaggle.competitions = [];
    web3.eth.getAccounts(function(error, accounts){
      var account = accounts[0];
      App_kaggle.contracts.Daggle.deployed().then(async function(instance){
          console.log(instance);
          data = await instance.getNumberOfCompetitions();
          let n = data===undefined?0:data.toNumber();
          for (i = 0; i<n; i++){
            data = await instance.competitions(i);
            competition = {};
            competition['id'] = data[0].toNumber();
            competition['problemOwner'] = data[1];
            competition['title'] = data[2];
            competition['description'] = data[3];
            competition['reward'] = data[4].toNumber();
            competition['trainFileAfid'] = data[5];
            competition['testFileAfid'] = data[6];
            competition['currentLeader'] = data[7];
            competition['bestAccuracy'] = data[8];
            competition['isFinished'] = data[9];
            submissionData = await instance.getSubmission(i);
            submission = {};
            submission['fileAfid'] = submissionData[0];
            submission['accuracy'] = submissionData[1].toNumber();
            d = new Date(submissionData[2].toNumber()*1000);
            submission['time'] = d.toLocaleString();
            competition['submission'] = submission;
            console.log(competition);
            App_kaggle.competitions.push(competition);
          }
          var competitionRow = $('#competitionRow');
          var competitionTemplate = $('#competitionTemplate');
          App_kaggle.competitions.forEach((data, idx)=>{
            competitionTemplate.find('.panel-body').attr("competition-id", data['id']);
            competitionTemplate.find('.panel-title').text(data.title);
            competitionTemplate.find('.competition-description').text(data.description);
            competitionTemplate.find('.competition-id').text(data.id);
            competitionTemplate.find('.competition-reward').text(data.reward);
            competitionTemplate.find('.competition-training-file').text("download");
            competitionTemplate.find('.competition-training-file').attr("onclick", "downloadFile('" + data.trainFileAfid + "', 'train.csv')");
            competitionTemplate.find('.competition-testing-file').text("download");
            competitionTemplate.find('.competition-testing-file').attr("onclick", "downloadFile('" + data.testFileAfid + "', 'test.csv')");
            competitionTemplate.find('.competition-owner').text(data.problemOwner);
            competitionTemplate.find('.btn-menu').attr("onclick", "preFillID(" + idx + ")");
            submissionData = data.submission;
            if (submissionData['fileAfid'] != ''){
              competitionTemplate.find('.submission-afid').text(submissionData['fileAfid']);
              competitionTemplate.find('.submission-accuracy').text(submissionData['accuracy']);
              competitionTemplate.find('.submission-time').text(submissionData['time']);
            } else{
              competitionTemplate.find('.submission-afid').text("");
              competitionTemplate.find('.submission-accuracy').text("");
              competitionTemplate.find('.submission-time').text("");
            }
            competitionRow.append(competitionTemplate.html());
          });
      })
    })
  },
  submitModel: function(submissionData){
    console.log("model submission");
    console.log(submissionData);

    var DaggleInstance;

    web3.eth.getAccounts(function(error, accounts){
      var account = accounts[0];
      App_kaggle.contracts.Daggle.deployed().then(async function(instance){
        DaggleInstance = instance;
        result = await DaggleInstance.submit(
          submissionData['competitionID'],
          submissionData['submissionAfid'],
          {from: account}
        );
        submissionRes = await DaggleInstance.getSubmission(submissionData['competitionID']);
        submission = {};
        submission['fileAfid'] = submissionRes[0];
        submission['accuracy'] = submissionRes[1].toNumber();
        d = new Date(submissionRes[2].toNumber()*1000);
        submission['time'] = d.toLocaleString();
        var competitionTemplate = $('.panel-body[competition-id=' + submissionData['competitionID'].toString() + ']');
        competitionTemplate.find('.submission-afid').text(submission['fileAfid']);
        competitionTemplate.find('.submission-accuracy').text(submission['accuracy']);
        competitionTemplate.find('.submission-time').text(submission['time']);
      })
    })
  },
  createCompetition: function(competitionData) {
    console.log("createCompetition");
    console.log(competitionData);

    var DaggleInstance;

    web3.eth.getAccounts(function(error, accounts){
      var account = accounts[0];
      App_kaggle.contracts.Daggle.deployed().then(function(instance){
        DaggleInstance = instance;
        return DaggleInstance.createCompetition(
            competitionData['title'],
            competitionData['description'],
            competitionData['reward'],
            competitionData['trainingFileAfid'],
            competitionData['testingFileAfid'],
            {from: account, value: web3.toWei(competitionData['reward'],'ether')});
      })
      .then(function(result){
        console.log(result);
      })

    })
  }
}

$(function() {
  $(window).load(function() {
    App_kaggle.init();
  });
});

function preFillID(idx){
  $('#competitionID').val(idx.toString());
}

function downloadFile(afid, filename){
  xhttp = new XMLHttpRequest();
  xhttp.onreadystatechange = function() {
    var a;
    if (xhttp.readyState === 4 && xhttp.status === 200) {
        // Trick for making downloadable link
        a = document.createElement('a');
        a.href = window.URL.createObjectURL(xhttp.response);
        // Give filename you wish to download
        a.download = filename;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
      }
  };
  xhttp.open('GET', 'http://9218.afilesys.xyz:5142/afs_download?afid=' + afid);
  xhttp.responseType = 'blob';
  xhttp.send();

}
